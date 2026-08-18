import { __handler } from "../../sdk/runtime.ts";
import { tier3UnlimitedQuote, tier3UnlimitedEnabled, tier3UnlimitedMinUsd, tier3UnlimitedDeliveryOutlook } from "../../sdk/tier3-unlimited.ts";
import { inventoryStatus } from "../../sdk/inventory-governor.ts";

// tier3UnlimitedQuote (read-only, public-facing) — quote a "Tier 3 Unlimited" package for a given budget at/above
// the $200k Tier 2 base. Deliverables + advertising value + guaranteed impressions scale proportionally from the
// A–D rate card (same ~2× value ratio). Delivery is capacity-paced and prepaid, backed by the delivery guarantee.
// If the budget is bigger than the audience can serve now, the full purchased volume is delivered OVER TIME —
// matched to their number as the audience grows (never oversold, never time-capped). Never a revenue/ROI promise.
//   { budget_usd }  → the scaled quote + delivery outlook
export default __handler(async (req) => {
  try {
    if (!tier3UnlimitedEnabled()) return Response.json({ enabled: false });
    const body = await req.json().catch(() => ({}));
    const budget = Number(body.budget_usd) || tier3UnlimitedMinUsd();
    const quote = tier3UnlimitedQuote(budget);

    // Live inventory: how much the current audience can serve per year, so we can show the over-time outlook.
    let annualCapacity = 0;
    try { const inv = await inventoryStatus(); annualCapacity = Number(inv?.annual_capacity) || 0; } catch { /* capacity unknown */ }
    const delivery = tier3UnlimitedDeliveryOutlook(quote.guaranteed_impressions_per_year, annualCapacity);

    return Response.json({
      ...quote,
      delivery,
      disclaimer: "Deliverables are valued at conventional market rates and delivered capacity-paced, backed by " +
        "our delivery guarantee — if your budget is larger than the current audience can serve, we deliver the " +
        "full amount over time (matched to your number, never oversold). It is not a promise of revenue, sales, " +
        "or ROI. Paid upfront — no credit.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
