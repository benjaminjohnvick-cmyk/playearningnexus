import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { breakageRecognitionPct, pointValueUsd } from "../../sdk/revenue.ts";
import { breakageUsd, coverage } from "../../sdk/funding-pool.ts";
import { pooledAnnualRevenueUsd } from "../../sdk/loyalty.ts";

// breakageReport (INTERNAL/ADMIN) — Suggestion 2 + 4. Tracks closed-loop points OUTSTANDING vs REDEEMED,
// recognizes breakage (the unredeemed portion = retained margin), and shows that breakage + the advertiser
// pool COVER the platform-funded subsidies (e.g. seller cash-back). This is where the "10%" actually lands:
// not a customer charge, but the value of points that are never redeemed.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const pointUsd = pointValueUsd();

    // Outstanding = points currently HELD by users (bounded scan).
    const users = await base44.asServiceRole.entities.User.filter({}, undefined, 50000).catch(() => []) as Record<string, unknown>[];
    let outstandingPoints = 0;
    for (const u of (users || [])) outstandingPoints += Number(u.points) || 0;

    // Redeemed = points already spent on orders (best-effort from points orders).
    const pointOrders = await base44.asServiceRole.entities.Order.filter({ payment_method: "points" }, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let redeemedPoints = 0;
    for (const o of (pointOrders || [])) redeemedPoints += Number(o.points_spent) || Number(o.points) || 0;

    // Subsidies to date (seller cash-back etc.) — the perks breakage + the pool must cover.
    const events = await base44.asServiceRole.entities.RevenueEvent.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let subsidiesUsd = 0, revenueUsd = 0;
    for (const e of (events || [])) {
      const amt = Number(e.amount_usd) || 0;
      if (e.kind === "subsidy") subsidiesUsd += amt; else revenueUsd += amt;
    }

    const recognizedBreakageUsd = breakageUsd(outstandingPoints, breakageRecognitionPct(), pointUsd);
    const advertiserPoolUsd = await pooledAnnualRevenueUsd().catch(() => 0);
    const cov = coverage(subsidiesUsd, recognizedBreakageUsd, advertiserPoolUsd);

    return Response.json({
      points: {
        outstanding: outstandingPoints,
        redeemed: redeemedPoints,
        outstanding_usd: Math.round(outstandingPoints * pointUsd * 100) / 100,
        redeemed_usd: Math.round(redeemedPoints * pointUsd * 100) / 100,
        point_value_usd: pointUsd,
      },
      breakage: {
        recognition_pct: breakageRecognitionPct(),
        recognized_usd: recognizedBreakageUsd,
        note: "Recognized breakage = outstanding points × recognition rate. This is retained margin — no customer paid it.",
      },
      subsidies_usd: Math.round(subsidiesUsd * 100) / 100,
      recorded_revenue_usd: Math.round(revenueUsd * 100) / 100,
      advertiser_pool_usd: advertiserPoolUsd,
      coverage: cov,
      seller_cashback_is_free: cov.covered,   // true when breakage + pool fully cover the perks
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
