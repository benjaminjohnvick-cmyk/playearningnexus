import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { tier2MultiYearCommitmentOptin, tier2TermYears, tier2ContinuationResultsMult, tier2RenewalNoticeDays } from "../../sdk/tier2-scaling.ts";

// tier2AcceptMultiYear (authenticated) — the advertiser VOLUNTARILY opts into the multi-year (up to 5 yr)
// Tier 2 term in exchange for consideration (locked founding discount / bonus inventory). This is the ONLY
// thing that makes a results-warranted continuation binding. Requires an explicit, recorded acceptance; the
// commitment is still results-gated (a year that doesn't warrant it lets them exit) and carries renewal notice.
//   { accept: true } → { ok, committed, terms } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    if (!tier2MultiYearCommitmentOptin()) {
      return Response.json({ error: "The multi-year commitment option isn't available." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.accept !== true) {
      return Response.json({ error: "You must explicitly accept the multi-year terms to opt in." }, { status: 400 });
    }

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows && rows[0] ? rows[0] : null;
    if (!rec) return Response.json({ error: "You need an active Tier 2 plan before committing to the multi-year term." }, { status: 409 });

    const terms = {
      term_years: tier2TermYears(),
      continuation_results_multiple: tier2ContinuationResultsMult(),
      renewal_notice_days: tier2RenewalNoticeDays(),
      consideration: "Locked founding discount and bonus inventory for the full committed term.",
      protections: [
        "Continuation each year is RESULTS-GATED — a year that doesn't return at least the results multiple lets you exit; you are never held in a losing year.",
        `You receive ${tier2RenewalNoticeDays()} days' advance notice before each annual renewal and can cancel before it begins.`,
        "This commitment is voluntary and applies only because you accepted it here.",
      ],
    };

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await recordConsent({
      user_id: uid, kind: "tier2_multiyear_commitment", version: "2026-01", accepted: true,
      shown: terms, ip, meta: { plan_id: rec.id },
    }).catch(() => null);

    await db.update("Tier2ScalingPlan", String(rec.id), {
      multiyear_committed: true,
      multiyear_committed_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ ok: true, committed: true, terms });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
