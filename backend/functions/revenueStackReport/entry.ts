import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { breakageRecognitionPct, pointValueUsd } from "../../sdk/revenue.ts";
import {
  buildRevenueStack, customerFiveYearValue, topCustomersByValue,
  revenueStackAnnualTargetUsd, revenueStackHorizonYears, type LedgerRow,
} from "../../sdk/revenue-stack.ts";

// revenueStackReport (INTERNAL/ADMIN) — measures the BLENDED $200k/year revenue stack over a 5-year horizon.
//
// Reporting only: reads the unified RevenueEvent ledger, annualizes each business-funded line, compares the
// blend to the target, splits sales-driven vs activity-driven, and projects the stack (and each customer)
// over the horizon. Never bills anyone. PPC advertiser LTV stays $12,000 — "advertising" is one line here.
//   Body: { days?: number, business_id?: string, top?: number }
//     days        → trailing window to annualize from (default 90)
//     business_id → also return that one customer's 5-year value
//     top         → also return the top-N customers by projected 5-year value
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(3650, Math.round(Number(body.days) || 90)));

    const rows = await base44.asServiceRole.entities.RevenueEvent.filter({}, "-created_date", 20000).catch(() => []) as LedgerRow[];

    // B14 — breakage annual estimate from OUTSTANDING closed-loop points (a stock, not a ledger flow).
    const users = await base44.asServiceRole.entities.User.filter({}, undefined, 50000).catch(() => []) as Record<string, unknown>[];
    let outstandingPoints = 0;
    for (const u of (users || [])) outstandingPoints += Number(u.points) || 0;
    const breakageAnnualUsd = Math.round(outstandingPoints * pointValueUsd() * breakageRecognitionPct() * 100) / 100;

    const stack = buildRevenueStack(rows, days, { breakageAnnualUsd });

    const out: Record<string, unknown> = {
      stack,
      annual_target_usd: revenueStackAnnualTargetUsd(),
      horizon_years: revenueStackHorizonYears(),
      note:
        "Blended revenue-stack model — reporting only, nothing is billed. $200k/yr is the SUM of every " +
        "business-funded line; PPC advertiser LTV stays $12,000 (one 'advertising' line). Sales-driven lines " +
        "are businesses you sign; activity-driven lines are minted by member engagement (the floor that " +
        "de-risks the target). 'Results' proof (attributed sales) is per-business in customerLifetimeValue / " +
        "the attributed-sales measurement. customer_paid_usd must stay 0 — customers are never charged a markup.",
    };

    if (body.business_id) {
      out.customer = customerFiveYearValue(rows, String(body.business_id), days);
    }
    if (body.top) {
      out.top_customers = topCustomersByValue(rows, days, Math.max(1, Math.min(200, Math.round(Number(body.top) || 10))));
    }

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
