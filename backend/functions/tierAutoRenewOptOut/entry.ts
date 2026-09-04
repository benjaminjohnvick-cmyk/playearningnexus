import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import {
  autoRenewEnabled, autoRenewDefaultEnrolled, autoRenewTermYears, autoRenewAdvanceDays, autoRenewFinalHours,
  renewalTiming, recTier, appliesToTier, isEnrolled,
} from "../../sdk/tier-autorenew.ts";

// tierAutoRenewOptOut (authenticated) — how a Tier 2/3 seat-holder controls the DEFAULT auto-renewal:
//   { }                       → read status (enrolled?, next renewal, notice windows)
//   { opt_out: true }         → opt OUT of auto-renewal (term ends at year boundary; no charge)
//   { opt_out: false }        → opt back IN
// This is the "easy cancellation" path the auto-renewal laws require. It sets a flag on the advertiser's own
// seat record and records the choice in the consent ledger. It never charges or refunds anything.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    // The caller's active advertiser seat (admins may target another via advertiser_id).
    const body = await req.json().catch(() => ({}));
    const targetId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : uid;
    const rows = await db.filter("FoundingAdvertiser", { user_id: targetId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec) return Response.json({ error: "No advertiser seat found." }, { status: 404 });

    if (!appliesToTier(rec)) {
      return Response.json({ error: `Auto-renewal applies to Tier 2/3 seats only (this seat is Tier ${recTier(rec) || "?"}).` }, { status: 400 });
    }

    const nowISO = new Date().toISOString();

    // Mutating choice?
    if (typeof body.opt_out === "boolean") {
      const optOut = body.opt_out === true;
      await db.update("FoundingAdvertiser", String(rec.id), {
        auto_renew_optout: optOut,
        auto_renew_optin: !optOut,
        auto_renew_choice_at: nowISO,
      }).catch(() => null);
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      await recordConsent({
        user_id: targetId, kind: "tier_autorenew_choice", version: "tier-autorenew-1",
        accepted: !optOut, shown: "tier-autorenew-1", ip,
        meta: { opt_out: optOut, tier: recTier(rec), seat_id: rec.id, source: String(body.source ?? "advertiser_setting") },
      }).catch(() => null);
      // Reflect the change for the status echo below.
      (rec as Record<string, unknown>).auto_renew_optout = optOut;
      (rec as Record<string, unknown>).auto_renew_optin = !optOut;
    }

    const t = renewalTiming(rec, Date.parse(nowISO));
    const enrolled = isEnrolled(rec);
    return Response.json({
      ok: true,
      posture_enabled: autoRenewEnabled(),
      default_enrolled: autoRenewDefaultEnrolled(),
      tier: recTier(rec),
      enrolled,
      opted_out: rec.auto_renew_optout === true,
      term_years: autoRenewTermYears(),
      renewals_done: t.applies ? Math.max(0, t.target_index - 1) : 0,
      in_term: t.in_term,
      next_renewal_at: Number.isNaN(t.renew_at_ms) ? null : new Date(t.renew_at_ms).toISOString(),
      advance_notice_days: autoRenewAdvanceDays(),
      final_notice_hours: autoRenewFinalHours(),
      note: enrolled
        ? "This seat is set to auto-renew (results permitting). You can opt out any time before the renewal date — no charge if you opt out."
        : "This seat will NOT auto-renew. You can opt back in any time.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
