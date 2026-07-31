import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { maxPointsPerTransaction } from "../../sdk/redemption.ts";
import { recordMoneyFlow, netChargeAfterDiscount } from "../../sdk/paypal.ts";
import { paypalConfigured, createOrder } from "../../sdk/paypal-api.ts";
import { chooseChannel, buyingDeskEnabled, type SourcedItem } from "../../sdk/sourcing.ts";

// assistedCheckout (authenticated) — the user APPROVES a drafted item and we execute it through the right
// SANCTIONED channel. The buyer always completes/authorizes their own purchase; no bot, no stranger, no
// money moved to a workforce.
//   • affiliate   → hand the buyer to the retailer's own checkout (retailer is merchant of record). No charge here.
//   • dropship    → FULL AUTO: buyer checks out once on our store (points opt-in + PayPal for the net); the
//                   supplier order fires on payment (dropshipFulfill). We're the merchant of record.
//   • buying_desk → queue a manual task for the team (rare, no-sanctioned-channel fallback).
//   Body: { sourced_order_id, item_index?, apply_points?, shipping? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { sourced_order_id, item_index, apply_points = false, shipping } = await req.json().catch(() => ({}));
    if (!sourced_order_id) return Response.json({ error: "sourced_order_id required" }, { status: 400 });

    const so = await base44.asServiceRole.entities.SourcedOrder.filter({ id: sourced_order_id }).then((r: any) => r[0]);
    if (!so) return Response.json({ error: "Order draft not found" }, { status: 404 });
    if (so.user_id !== user.id) return Response.json({ error: "Not your order" }, { status: 403 });

    const items = (so.items as SourcedItem[]) || [];
    const idx = Number.isFinite(Number(item_index)) ? Math.max(0, Math.min(items.length - 1, Math.round(Number(item_index)))) : (Number(so.recommendation_index) || 0);
    const item = items[idx];
    if (!item) return Response.json({ error: "No item to check out" }, { status: 400 });

    const ch = chooseChannel(item);

    // ── AFFILIATE: hand off to the retailer; the buyer pays them directly. Nothing charged here. ──────────
    if (ch.channel === "affiliate") {
      await db.update("SourcedOrder", String(so.id), { status: "handed_off", chosen_index: idx, channel: "affiliate" }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "assisted_checkout", title: "↗️ Continue to the retailer",
        message: `Finish buying "${item.title}" on ${item.retailer || "the retailer"} — you pay them directly.`, is_read: false,
      }).catch(() => null);
      return Response.json({ success: true, channel: "affiliate", merchant_of_record: "retailer", buy_url: item.buy_url, message: "You'll complete this purchase on the retailer's own site." });
    }

    // ── BUYING DESK: queue a manual task (no sanctioned auto-channel for this SKU). ───────────────────────
    if (ch.channel === "buying_desk" || (!item.supplier_id && !buyingDeskEnabled())) {
      const order = await base44.asServiceRole.entities.Order.create({
        user_id: user.id, item_name: item.title, amount: item.price_usd, payment_method: "card", payment_captured: false,
        source: "buying_desk", shipping_address: shipping || null, status: "awaiting_payment", created_at: new Date().toISOString(),
      }).catch(() => null);
      await base44.asServiceRole.entities.BuyingDeskTask.create({
        user_id: user.id, sourced_order_id: so.id, order_id: (order as any)?.id || null, item, shipping: shipping || null,
        status: "pending", created_at: new Date().toISOString(),
      }).catch(() => null);
      await db.update("SourcedOrder", String(so.id), { status: "queued_buying_desk", chosen_index: idx, channel: "buying_desk" }).catch(() => null);
      return Response.json({ success: true, channel: "buying_desk", order_id: (order as any)?.id || null, message: "Our team will place this order for you — you'll be notified when it ships." });
    }

    // ── DROPSHIP (full auto): buyer checks out once on our store. Points opt-in + PayPal for the net. ─────
    const faceUsd = Number(item.price_usd) || 0;
    const pointUsd = pointValueUsd();
    const balance = Number(user.points) || 0;
    let pointsApplied = 0, pointsUsd = 0;
    if (apply_points && balance > 0) {
      const premium = await isPremiumUser(user.id);
      const cap = maxPointsPerTransaction({ isPremium: premium, userPoints: balance });
      pointsApplied = Math.max(0, Math.min(cap.points, Math.floor(faceUsd / pointUsd)));
      pointsUsd = Math.round(pointsApplied * pointUsd * 100) / 100;
    }
    const cardNet = netChargeAfterDiscount(faceUsd, pointsUsd);

    if (pointsApplied > 0) {
      const ok = await adjustUserBalance(user.id, -pointsApplied, { field: "points" });
      if (ok === null) return Response.json({ error: "Couldn't apply your points — please try again." }, { status: 409 });
    }
    if (pointsUsd > 0) await recordMoneyFlow({ direction: "out", amount_usd: pointsUsd, kind: "points_redemption_fulfillment", ref: String(so.id), meta: { user_id: user.id, funded_by: "paypal_business_account" } }).catch(() => null);

    const paidNow = cardNet <= 0;
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id, item_name: item.title, amount: cardNet, points_spent: pointsApplied || null, points_usd_funded: pointsUsd,
      payment_method: "card_points", payment_captured: paidNow, source: "dropship", supplier_id: item.supplier_id || null,
      sourced_order_id: so.id, item_sku: item.sku || null, shipping_address: shipping || null,
      status: paidNow ? "awaiting_shipment" : "awaiting_payment", created_at: new Date().toISOString(),
    });

    let approveUrl: string | null = null;
    if (!paidNow && paypalConfigured()) {
      try { const pp = await createOrder({ amountUsd: cardNet, ref: String((order as any).id), description: item.title }); approveUrl = pp.approve_url; await db.update("Order", String((order as any).id), { paypal_order_id: pp.id, paypal_status: pp.status }).catch(() => null); } catch { /* awaiting_payment */ }
    }
    // Points covered it → fulfill (place the supplier order) now; otherwise it fires on PayPal capture.
    if (paidNow) base44.asServiceRole.functions.invoke("dropshipFulfill", { order_id: (order as any).id }).catch(() => null);

    await db.update("SourcedOrder", String(so.id), { status: "checked_out", chosen_index: idx, channel: "dropship", order_id: (order as any).id }).catch(() => null);
    return Response.json({
      success: true, channel: "dropship", merchant_of_record: "platform", order_id: (order as any).id,
      points_applied: pointsApplied, points_usd: pointsUsd, card_charge_usd: cardNet, approve_url: approveUrl, paypal_configured: paypalConfigured(),
      message: pointsApplied > 0 ? `Applied ${pointsApplied.toLocaleString()} points ($${pointsUsd.toFixed(2)}); your card covers $${cardNet.toFixed(2)}. We'll ship it automatically.` : `Your card covers $${cardNet.toFixed(2)}. We'll ship it automatically.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
