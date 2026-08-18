import { __handler } from "../../sdk/runtime.ts";
import { tier3UnlimitedQuote, tier3UnlimitedEnabled, tier3UnlimitedMinUsd } from "../../sdk/tier3-unlimited.ts";

// tier3UnlimitedQuote (read-only, public-facing) — quote a "Tier 3 Unlimited" package for a given budget at/above the
// $200k Tier 2 base. Deliverables + advertising value + guaranteed impressions scale proportionally from the
// A–D rate card (same ~2× value ratio). Delivery is capacity-paced and prepaid, backed by the delivery
// guarantee. This is advertising value DELIVERED — never a promise of revenue or ROI.
//   { budget_usd }  → the scaled quote
export default __handler(async (req) => {
  try {
    if (!tier3UnlimitedEnabled()) return Response.json({ enabled: false });
    const body = await req.json().catch(() => ({}));
    const budget = Number(body.budget_usd) || tier3UnlimitedMinUsd();
    const quote = tier3UnlimitedQuote(budget);
    return Response.json({
      ...quote,
      disclaimer: "Deliverables are valued at conventional market rates and delivered capacity-paced, backed by " +
        "our delivery guarantee. It is not a promise of revenue, sales, or ROI. Paid upfront — no credit.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
