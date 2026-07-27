import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { runOptimizationPass, OPTIMIZABLE } from "../../sdk/optimizer.ts";

// aiPricingOptimizer (INTERNAL/ADMIN, scheduled) — the pricing loop only: tunes the price/economy
// settings from store, membership, contest, and customer pricing-survey data. All price changes are
// money-sensitive, so this produces recommendations for admin approval (never silent price moves).
const PRICE_KEYS = OPTIMIZABLE.filter((o) => o.priceLike).map((o) => o.key);

export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const report = await runOptimizationPass({ only: PRICE_KEYS });
    return Response.json({ success: true, scope: "pricing", price_keys: PRICE_KEYS, ...report });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
