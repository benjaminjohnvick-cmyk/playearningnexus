import { __handler } from "../../sdk/runtime.ts";
import { tier2PlusQuote, tier2PlusEnabled, tier2PlusMinUsd } from "../../sdk/tier2-plus.ts";

// tier2PlusQuote (read-only, public-facing) — quote a "Tier 2 Plus" package for a given budget at/above the
// $200k Tier 2 base. Deliverables + advertising value + guaranteed impressions scale proportionally from the
// A–D rate card (same ~2× value ratio). Delivery is capacity-paced and prepaid, backed by the delivery
// guarantee. This is advertising value DELIVERED — never a promise of revenue or ROI.
//   { budget_usd }  → the scaled quote
export default __handler(async (req) => {
  try {
    if (!tier2PlusEnabled()) return Response.json({ enabled: false });
    const body = await req.json().catch(() => ({}));
    const budget = Number(body.budget_usd) || tier2PlusMinUsd();
    const quote = tier2PlusQuote(budget);
    return Response.json({
      ...quote,
      disclaimer: "Deliverables are valued at conventional market rates and delivered capacity-paced, backed by " +
        "our delivery guarantee. It is not a promise of revenue, sales, or ROI. Paid upfront — no credit.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
