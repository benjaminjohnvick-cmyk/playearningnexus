import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { progressionEnabled, yearsAccounting, renewalEligible, renewalPatch, normalizeTier } from "../../sdk/tier-progression.ts";

// advertiserRenewAgree — the one-tap "Agree" that renews the SAME tier for another year after the advertiser
// has seen their results. Records the renewal consent (auto-renewal law: they saw a notice + agreed), banks a
// year toward the caps, and restarts the term. Does NOT move money — billing runs on the normal path after the
// disclosed notice; this records the authorization.
export const RENEWAL_DISCLOSURE_VERSION = "tier-renewal-1";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!progressionEnabled()) return Response.json({ error: "Tier progression is disabled." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.agree !== true) return Response.json({ error: "You must agree to renew." }, { status: 400 });

    const advertiserId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : user.id;
    const rows = await db.filter("FoundingAdvertiser", { user_id: advertiserId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec) return Response.json({ error: "No advertiser record found." }, { status: 404 });

    const today = new Date().toISOString();
    const acc = yearsAccounting(rec, today);
    if (!renewalEligible(rec, acc)) {
      return Response.json({ error: "This tier can't be renewed further — the year cap for this stage is reached.", years: acc }, { status: 409 });
    }

    const patch = renewalPatch(rec, today);
    await db.update("FoundingAdvertiser", rec.id as string, patch).catch(() => null);
    await recordConsent({
      user_id: advertiserId, kind: "tier_renewal", version: RENEWAL_DISCLOSURE_VERSION, accepted: true, shown: RENEWAL_DISCLOSURE_VERSION,
      meta: { tier: normalizeTier(rec.current_tier ?? rec.tier), renewals: patch.renewals, source: "see_results_agree" },
    }).catch(() => null);
    await db.create("TierProgressionEvent", {
      advertiser_id: advertiserId, kind: "renewal", tier: normalizeTier(rec.current_tier ?? rec.tier),
      renewals: patch.renewals, at: today, created_at: today,
    }).catch(() => null);

    return Response.json({
      success: true, renewed: true, tier: normalizeTier(rec.current_tier ?? rec.tier),
      years: yearsAccounting({ ...rec, ...patch }, today),
      note: "Renewed for another year. Your locked price is unchanged; billing runs on the normal cycle after the disclosed notice. You can cancel anytime.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
