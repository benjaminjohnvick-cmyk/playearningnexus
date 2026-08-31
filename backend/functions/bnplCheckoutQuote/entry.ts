import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  bnplCheckoutEnabled, bnplServiceFeePct, bnplLimitUsd, bnplPremiumOnly,
  computeBnplOrder, maxFinanceableItemPrice, bnplEligible,
} from "../../sdk/bnpl-checkout.ts";

// bnplCheckoutQuote — the user-facing QUOTE for financing a real-goods order via PayPal Pay Later. Given an item
// price it returns the uniform order service fee, the financed total, whether it fits under the PayPal limit,
// and the max item price that would (leaving room for the fee). It also states plainly that the loan is the
// user's own obligation to PayPal — the platform never funds, covers, or repays any part of it. It performs NO
// PayPal charge (the live Pay Later API needs PayPal merchant onboarding) and is gated OFF pending counsel.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const enabled = bnplCheckoutEnabled();
    const premiumOnly = bnplPremiumOnly();
    const isPremium = (user as Record<string, unknown>).is_premium === true || (user as Record<string, unknown>).premium === true || String((user as Record<string, unknown>).membership_tier ?? "").toLowerCase() === "premium";

    const elig = bnplEligible({ enabled, isPremium, premiumOnly });
    const feePct = bnplServiceFeePct();
    const limit = bnplLimitUsd();
    const itemPrice = Math.max(0, Number(body.item_price_usd) || 0);
    const order = computeBnplOrder(itemPrice, feePct, limit);

    return Response.json({
      ok: true,
      enabled, eligible: elig.eligible, eligibility_reason: elig.reason,
      service_fee_pct: feePct, limit_usd: limit,
      max_item_price_usd: maxFinanceableItemPrice(limit, feePct),
      quote: {
        item_price_usd: order.itemPrice, service_fee_usd: order.fee, financed_total_usd: order.total,
        within_limit: order.withinLimit,
      },
      disclosures: [
        `A ${Math.round(feePct * 100)}% service fee applies to this order regardless of how you pay (it is not a fee for choosing PayPal).`,
        "If you choose PayPal Pay Later, you borrow from PayPal and repay PayPal directly — this platform is only the store.",
        "The platform does not fund, cover, guarantee, or repay any part of your Pay Later plan.",
      ],
      note: enabled ? "Quote only — the live PayPal Pay Later charge requires PayPal onboarding." : "BNPL checkout is OFF (pending counsel) — quote/preview only.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
