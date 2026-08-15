import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { premiumBoostConfig, memberGrant, MEMBER_CREDIT_FIELD } from "../../sdk/premium-boost.ts";

// premiumBoostApply (auth) — the member applies a chosen amount of their boost credit to a specific item.
// They pick how much of the boost to use and which item. Debits the non-cashable boost credit and hands the
// applied amount to the normal order/fulfillment flow. Bounded by the item price and their credit.
//   Body: { item_name, item_price_usd?, amount_usd, product_ref? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const u = user as Record<string, unknown>;
    const cfg = await premiumBoostConfig(u.jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "Premium boost is not available." }, { status: 400 });

    const uid = String(user.id);
    const body = await req.json().catch(() => ({}));
    const item = String(body.item_name || "").trim().slice(0, 200);
    if (!item) return Response.json({ error: "Pick an item to apply your boost to." }, { status: 400 });
    let amount = Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    if (amount <= 0) return Response.json({ error: "Enter how much of your boost to use." }, { status: 400 });
    const price = body.item_price_usd != null ? Math.max(0, Math.round((Number(body.item_price_usd)) * 100) / 100) : null;
    if (price != null && amount > price) amount = price; // can't apply more than the item costs

    const credit = Math.round((Number(u[MEMBER_CREDIT_FIELD]) || 0) * 100) / 100;
    if (amount > credit) return Response.json({ error: `You only have $${credit.toLocaleString()} of boost credit.` }, { status: 400 });

    const debited = await adjustUserBalance(uid, -amount, { field: MEMBER_CREDIT_FIELD });
    if (debited === null) return Response.json({ error: "Couldn't apply the boost right now — try again." }, { status: 409 });

    const grant = await memberGrant(uid);
    if (grant?.id) await db.update("PremiumBoostGrant", String(grant.id), { used_usd: Math.round(((Number(grant.used_usd) || 0) + amount) * 100) / 100, updated_at: new Date().toISOString() }, uid);

    return Response.json({
      success: true, applied_usd: amount, remaining_credit_usd: Math.round((credit - amount) * 100) / 100,
      // Fulfillment hand-off: apply this as a discount/credit on the item's order in your normal checkout flow.
      apply_to: { item_name: item, product_ref: body.product_ref ?? null, amount_usd: amount, item_price_usd: price },
      note: `Applied $${amount.toLocaleString()} of your boost to “${item}.” The rest of your boost credit stays yours for other items.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
