import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { siteCashApplyPlan, resolveSiteCashAutoApply } from "../../sdk/site-cash-apply.ts";

// checkoutSiteCashQuote (auth, read-only) — how much Site Cash would auto-apply to a purchase of `price_usd`,
// and the resulting card/real-money remainder. Any checkout UI (especially client-captured card flows like the
// store) calls this BEFORE creating the card charge, so it can charge the reduced amount and show the discount.
// Honors the buyer's own auto-apply preference. Moves no money.
//   Body: { price_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const faceUsd = Number(body.price_usd) || 0;
    if (faceUsd <= 0) return Response.json({ error: "price_usd required" }, { status: 400 });

    const autoApply = resolveSiteCashAutoApply(user as Record<string, unknown>);
    const balance = Number(user.points) || 0;
    if (!autoApply || balance <= 0) {
      return Response.json({ auto_apply: autoApply, apply: false, points_applied: 0, points_usd: 0, face_usd: faceUsd, card_after_usd: faceUsd });
    }
    const premium = await isPremiumUser(user.id);
    const plan = siteCashApplyPlan({ faceUsd, userPoints: balance, isPremium: premium });
    return Response.json({ auto_apply: true, ...plan });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
