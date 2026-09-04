import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// deleteMyAccount (DSAR — GDPR/CCPA right to erasure). Anonymizes and deactivates the account.
// Financial / ledger records are RETAINED in de-identified form (tax + anti-fraud legal obligation),
// but the profile PII is scrubbed. Requires an explicit { confirm: true }.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return Response.json({ error: "Set confirm:true to permanently delete your account." }, { status: 400 });
    }

    await recordConsent({ user_id: user.id, kind: "dsar_delete_request", accepted: true }).catch(() => null);

    const anonEmail = `deleted+${user.id}@deleted.gamergain.local`;
    await db.update("User", user.id as string, {
      email: anonEmail,
      full_name: "Deleted User",
      phone_number: null,
      avatar_url: null,
      google_sub: null,
      date_of_birth: null,
      password_hash: null,
      reset_token_hash: null,
      reset_token_expires: null,
      notification_preferences: { email_enabled: false, sms_enabled: false },
      email_opt_out: true,
      sms_opt_out: true,
      account_status: "deleted",
      is_active: false,
      deleted_at: new Date().toISOString(),
    });

    // Erase behavioral / AI data collected about the user (not subject to financial retention).
    // Behavioral / AI / preference data erased on request. NOT financial records (Transaction, Payout,
    // MoneyLedgerEntry, tax) — those are retained in de-identified form as required by law.
    const ERASE_ENTITIES = [
      "UserJourneyEvent", "UXSessionRecording", "UserAIProfile", "SessionRating",
      "PricingFeedback", "SurveyHonestyAnalysis",
      // Broadened: more behavioral/preference data (missing entities are skipped).
      "SurveyResponse", "UserActivity", "PushSubscription", "StepUpVerification",
      "ChatMessage", "BuddyChatMessage", "Notification", "PayoutPreference", "RespondentTrustScore",
      "SocialMediaConnection",
    ];
    let erased = 0;
    for (const ent of ERASE_ENTITIES) {
      try {
        const rows = await db.filter(ent, { user_id: user.id }, "-created_date", 5000);
        for (const r of rows as Record<string, unknown>[]) { await db.remove(ent, r.id as string).catch(() => null); erased++; }
      } catch { /* best-effort */ }
    }

    return Response.json({
      success: true,
      deleted: true,
      behavioral_records_erased: erased,
      note: "Your profile and the behavioral/AI data collected about you have been erased; your account is deactivated. Financial records are retained in de-identified form as required by law.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
