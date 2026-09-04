import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import {
  premiumAutoRenewEnabled, premiumAutoRenewDefaultEnrolled, premiumAutoRenewTermYears,
  premiumAutoRenewAdvanceDays, premiumAutoRenewFinalHours, premiumAutoRenewRequireConsent,
  premiumRenewalTiming, premiumIsEnrolled, renewalsDone,
} from "../../sdk/premium-autorenew.ts";

// premiumAutoRenewOptOut (authenticated) — the member's control over Premium auto-renewal (the "click to
// cancel" path the law requires):
//   { }                          → read status
//   { opt_out: true }            → turn OFF auto-renew (cancel) — term ends at expiry, no charge
//   { opt_out: false, consent:true } → turn ON auto-renew WITH express affirmative consent (recorded)
// Never charges or refunds. Turning auto-renew ON records express consent (strict standard); turning it OFF is
// always allowed and takes effect immediately for the next cycle.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    const rows = await db.filter("PremiumPPCMembership", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec) return Response.json({ error: "No Premium membership found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const nowISO = new Date().toISOString();

    if (typeof body.opt_out === "boolean") {
      const optOut = body.opt_out === true;
      // Turning auto-renew ON (opt_out=false) is an affirmative choice → capture express consent (strict).
      if (!optOut && premiumAutoRenewRequireConsent() && body.consent !== true) {
        return Response.json({ error: "To turn on auto-renew you must give express consent to the auto-renew terms (pass consent:true)." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { auto_renew_optout: optOut, auto_renew_optin: !optOut, auto_renew_choice_at: nowISO };
      if (!optOut) { patch.auto_renew_consent = true; patch.auto_renew_consent_at = nowISO; }
      await db.update("PremiumPPCMembership", String(rec.id), patch).catch(() => null);
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      await recordConsent({
        user_id: uid, kind: "premium_autorenew_choice", version: "premium-autorenew-1",
        accepted: !optOut, shown: "premium-autorenew-1", ip,
        meta: { opt_out: optOut, membership_id: rec.id, source: String(body.source ?? "account_setting") },
      }).catch(() => null);
      Object.assign(rec, patch);
    }

    const t = premiumRenewalTiming(rec, Date.parse(nowISO));
    const enrolled = premiumIsEnrolled(rec);
    return Response.json({
      ok: true,
      posture_enabled: premiumAutoRenewEnabled(),
      default_enrolled: premiumAutoRenewDefaultEnrolled(),
      requires_consent: premiumAutoRenewRequireConsent(),
      enrolled,
      opted_out: rec.auto_renew_optout === true,
      has_consent: rec.auto_renew_consent === true || rec.auto_renew_optin === true,
      term_years: premiumAutoRenewTermYears(),
      renewals_done: renewalsDone(rec),
      next_renewal_at: Number.isNaN(t.renew_at_ms) ? null : new Date(t.renew_at_ms).toISOString(),
      advance_notice_days: premiumAutoRenewAdvanceDays(),
      final_notice_hours: premiumAutoRenewFinalHours(),
      note: enrolled
        ? "Premium is set to auto-renew. You can cancel any time before the renewal date — no charge if you cancel."
        : "Premium will NOT auto-renew. You can turn it back on any time (with consent).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
