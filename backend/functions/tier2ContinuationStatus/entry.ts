import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { tier2ContinuationStatus, tier2Parts, tier2TotalUsd } from "../../sdk/tier2-scaling.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";

// tier2ContinuationStatus (read-only) — the caller's multi-year (up to 5) Tier 2 continuation picture:
// whether last year's real attributed results WARRANT continuing, whether they voluntarily committed to the
// multi-year term (making a warranted year binding), and whether they may exit. Never charges. Results-gated
// + consent-gated: a losing year always lets them out; a binding stay always required their up-front opt-in.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows && rows[0] ? rows[0] : null;

    const parts = tier2Parts();
    const partsCompleted = Math.max(0, Math.floor(Number(rec?.parts_completed) || 0));
    const yearsCompleted = Number(rec?.years_completed) || (partsCompleted >= parts ? 1 : 0);
    const committed = !!rec?.multiyear_committed;

    // Real attributed results over the last year (the "warrant it" measure). Falls back to program start.
    const yearStartISO = String(rec?.current_year_started_at ?? rec?.started_at ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
    const lastYearResultsUsd = rec ? await attributedSalesUsd(db, uid, yearStartISO).catch(() => 0) : 0;

    const continuation = tier2ContinuationStatus({
      yearsCompleted, lastYearResultsUsd, committed, yearCostUsd: tier2TotalUsd(),
    });

    return Response.json({ has_plan: !!rec, continuation });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
