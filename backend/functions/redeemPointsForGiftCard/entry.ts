import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { maxPointsPerTransaction } from "../../sdk/redemption.ts";
import { pointsForGiftCardUsd, allocateGiftCard } from "../../sdk/giftcards.ts";
import { recordMoneyFlow } from "../../sdk/paypal.ts";

// redeemPointsForGiftCard (authenticated) — the gift-card rail: the user spends NON-CASHABLE points for a
// real retailer gift card they then use themselves. Store credit for a specific retailer — not cash to the
// user — so the closed-loop shield holds. Respects the per-transaction spend cap + inventory.
//   Body: { retailer, face_value_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { retailer, face_value_usd } = await req.json().catch(() => ({}));
    const faceUsd = Number(face_value_usd) || 0;
    if (!retailer || faceUsd <= 0) return Response.json({ error: "retailer and face_value_usd required" }, { status: 400 });

    const needed = pointsForGiftCardUsd(faceUsd);
    const balance = Number(user.points) || 0;
    if (balance < needed) return Response.json({ error: "Not enough points", required: needed, balance }, { status: 402 });

    // Per-transaction spend cap (12%/24% of balance).
    const premium = await isPremiumUser(user.id);
    const cap = maxPointsPerTransaction({ isPremium: premium, userPoints: balance });
    if (needed > cap.points) return Response.json({ spend_cap_exceeded: true, required: needed, max_points_this_transaction: cap.points, message: `You can spend up to ${cap.points.toLocaleString()} points at once (${Math.round(cap.capPct * 100)}% of your balance). This card needs ${needed.toLocaleString()}.` }, { status: 409 });

    // Allocate a card FIRST (marks it out of the pool), then debit points; release on debit failure.
    const card = await allocateGiftCard(String(retailer), faceUsd);
    if (!card) return Response.json({ error: `No ${retailer} gift cards in stock right now.` }, { status: 409 });

    const debited = await adjustUserBalance(user.id, -needed, { field: "points" });
    if (debited === null) {
      await db.updateIf("GiftCardStock", String(card.id), { status: "available", allocated_at: null }, { field: "status", equals: "allocated" }).catch(() => null);
      return Response.json({ error: "Couldn't debit your points — please try again." }, { status: 409 });
    }

    await db.update("GiftCardStock", String(card.id), { status: "redeemed", redeemed_by: user.id, redeemed_at: new Date().toISOString() }).catch(() => null);
    const redemption = await base44.asServiceRole.entities.GiftCardRedemption.create({
      user_id: user.id, retailer: String(retailer), face_value_usd: Number(card.face_value_usd) || faceUsd,
      points_spent: needed, giftcard_stock_id: card.id, code: card.code || null, created_at: new Date().toISOString(),
    }).catch(() => null);

    await recordMoneyFlow({ direction: "out", amount_usd: Number(card.face_value_usd) || faceUsd, kind: "giftcard_redemption", ref: String((redemption as any)?.id || card.id), meta: { user_id: user.id, retailer, points_spent: needed } }).catch(() => null);

    return Response.json({
      success: true, retailer: String(retailer), face_value_usd: Number(card.face_value_usd) || faceUsd,
      points_spent: needed, code: card.code || null, pin: card.pin || null,
      message: `Redeemed ${needed.toLocaleString()} points for a $${(Number(card.face_value_usd) || faceUsd).toFixed(2)} ${retailer} gift card. Spend it at ${retailer}.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
