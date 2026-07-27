import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// exportMyData (DSAR — GDPR/CCPA right to access & data portability). Returns the current user's
// personal data across the key entities. Read-only; logs the request to the consent ledger.
const EXPORT_ENTITIES = [
  "Transaction", "Order", "DailyEarnings", "Payout", "PayoutRequest", "WithdrawalRequest",
  "Referral", "Notification", "ConsentRecord", "SocialMediaConnection", "SupportTicket",
  "PPCTransaction", "MoneyLedgerEntry", "PremiumPPCMembership",
  // Behavioral / AI data collected about the user (DSAR must include these).
  "UserJourneyEvent", "UXSessionRecording", "UserAIProfile", "SessionRating",
  "PricingFeedback", "SurveyHonestyAnalysis", "MarketplaceListing",
];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profile = { ...user } as Record<string, unknown>;
    delete profile.password_hash;
    delete profile.reset_token_hash;
    delete profile.reset_token_expires;

    const data: Record<string, unknown> = { profile };
    for (const ent of EXPORT_ENTITIES) {
      try { data[ent] = await db.filter(ent, { user_id: user.id }, "-created_date", 5000); } catch { data[ent] = []; }
    }

    await recordConsent({ user_id: user.id, kind: "dsar_export", accepted: true }).catch(() => null);

    return Response.json({ success: true, exported_at: new Date().toISOString(), user_id: user.id, data });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
