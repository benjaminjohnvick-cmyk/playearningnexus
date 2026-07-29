import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { quoteDiscount, eligibleForDiscount } from "../../sdk/loyalty.ts";

// loyaltyQuoteDiscount — how much member discount applies to a given subtotal RIGHT NOW. Used by the
// cart UI. Returns only the discount for THIS cart (never the back-end pool balance or annual cap).
// Body: { subtotal_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const subtotal = Math.max(0, Number(body.subtotal_usd) || 0);

    const member = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;
    const eligible = eligibleForDiscount(member);
    const discount = quoteDiscount(member, subtotal);

    return Response.json({
      eligible,
      discount_usd: discount,
      final_usd: Math.round((subtotal - discount) * 100) / 100,
      note: eligible ? "Member discount applied (funded by your rewards, not a store markup change)." : "Complete today's steps to activate your discount.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
