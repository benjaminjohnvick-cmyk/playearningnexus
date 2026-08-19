import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { siteCashApplyPlan, resolveSiteCashAutoApply } from "../../sdk/site-cash-apply.ts";
import { recordMoneyFlow, netChargeAfterDiscount } from "../../sdk/paypal.ts";
import { paypalConfigured, createOrder } from "../../sdk/paypal-api.ts";

// hybridCheckout (authenticated) — pay by CREDIT CARD and (optionally) APPLY POINTS. The user's points cover
// as much as the per-transaction spend cap allows (12% non-premium / 24% premium of their balance); the AI
// order fulfillment — funded by the owner's PayPal business account — fronts the CASH value of those points
// to fulfillment, and the customer's card is charged only the remaining net. Points are consumed for goods
// (never paid out as cash), so the closed-loop shield holds.
//
// Money movement is EXECUTED by the connected PayPal + card processor, not here; this records the flows,
// deducts the points, opens the order, and kicks fulfillment.
//   Body: { listing_id, apply_points?: boolean, shipping_address? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Site Cash AUTO-APPLIES by default (SITE_CASH_AUTO_APPLY). A caller can still opt a single purchase out by
    // sending apply_points:false explicitly; sending apply_points:true forces it on even if the global default is off.
    const body = await req.json().catch(() => ({}));
    const { listing_id, shipping_address } = body;
    const applyPoints = body.apply_points === undefined ? resolveSiteCashAutoApply(user as Record<string, unknown>) : !!body.apply_points;
    if (!listing_id) return Response.json({ error: "listing_id required" }, { status: 400 });

    const listing = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: listing_id }).then((r: any) => r[0]);
    if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return Response.json({ error: `Listing is ${listing.status}` }, { status: 409 });

    const faceUsd = Number(listing.price_usd) || 0;
    if (faceUsd <= 0) return Response.json({ error: "This item isn't available for card purchase" }, { status: 400 });

    const balance = Number(user.points) || 0;

    // How much Site Cash to apply: bounded by the item price, the per-transaction spend cap (12%/24% of balance),
    // and the balance held. Same math as the manual apply — see site-cash-apply.ts.
    let pointsApplied = 0, pointsUsd = 0;
    if (applyPoints && balance > 0) {
      const premium = await isPremiumUser(user.id);
      const plan = siteCashApplyPlan({ faceUsd, userPoints: balance, isPremium: premium });
      pointsApplied = plan.points_applied;
      pointsUsd = plan.points_usd;
    }

    const cardNet = netChargeAfterDiscount(faceUsd, pointsUsd);

    // Card must be enabled if there's a cash remainder to charge.
    if (cardNet > 0 && !(await isEnabled("card_charging"))) {
      return Response.json({ blocked: true, reason: "card_payments_disabled", message: "Card payments aren't enabled yet. You can pay fully with points on eligible items, or contact support." }, { status: 403 });
    }

    // Atomically deduct the applied points (compare-and-set retry) BEFORE opening the order.
    if (pointsApplied > 0) {
      const ok = await adjustUserBalance(user.id, -pointsApplied, { field: "points" });
      if (ok === null) return Response.json({ error: "Couldn't apply your points — please try again.", balance }, { status: 409 });
    }

    // Claim the listing (active → sold) so we don't double-sell.
    const claimed = await db.updateIf("MarketplaceListing", listing.id, { status: "sold", sold_to: user.id, sold_at: new Date().toISOString() }, { field: "status", equals: "active" });
    if (!claimed) {
      if (pointsApplied > 0) await adjustUserBalance(user.id, pointsApplied, { field: "points" }).catch(() => null);   // refund points on race
      return Response.json({ error: "Sorry — this item was just sold." }, { status: 409 });
    }

    // Record the money flows: the points-covered value is FUNDED by PayPal (out); the card net comes IN at
    // capture (recorded now as intent; the processor confirms capture). Points redemption never pays cash to
    // the user — it buys goods.
    if (pointsUsd > 0) await recordMoneyFlow({ direction: "out", amount_usd: pointsUsd, kind: "points_redemption_fulfillment", ref: String(listing.id), meta: { user_id: user.id, points_applied: pointsApplied, funded_by: "paypal_business_account" } }).catch(() => null);

    const paidNow = cardNet <= 0;   // fully covered by points → nothing to capture on card
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id, seller_id: listing.seller_id, listing_id: listing.id, item_name: listing.title,
      amount: cardNet, points_spent: pointsApplied || null, points_usd_funded: pointsUsd,
      payment_method: "card_points", payment_captured: paidNow,
      source: listing.source || "user", shipping_address: shipping_address || null,
      status: paidNow ? "awaiting_shipment" : "awaiting_payment",
      created_at: new Date().toISOString(),
    });

    // Card remainder → start a LIVE PayPal payment when connected; the client redirects to approve_url and
    // then calls paypalCaptureCheckout, which captures, marks paid, and fires fulfillment. If PayPal isn't
    // configured yet, the order simply waits (awaiting_payment) so nothing breaks pre-launch.
    let approveUrl: string | null = null, paypalOrderId: string | null = null;
    if (!paidNow && paypalConfigured()) {
      try {
        const pp = await createOrder({ amountUsd: cardNet, ref: String((order as any).id), description: listing.title || "GamerGain order" });
        approveUrl = pp.approve_url; paypalOrderId = pp.id;
        await db.update("Order", String((order as any).id), { paypal_order_id: pp.id, paypal_status: pp.status }).catch(() => null);
      } catch { /* leave as awaiting_payment; client can retry via paypalCreateCheckout */ }
    }

    // Kick AI fulfillment only when there's nothing left to capture on the card (points covered it). Card
    // orders wait for PayPal capture before fulfillment/funds release.
    if (paidNow) base44.asServiceRole.functions.invoke("aiOrderFulfillment", { order_id: (order as any).id }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "marketplace_purchase",
      title: "🛍️ Order started",
      message: pointsApplied > 0
        ? `Applied ${pointsApplied.toLocaleString()} points ($${pointsUsd.toFixed(2)}) — your card will be charged $${cardNet.toFixed(2)}.`
        : `Your card will be charged $${cardNet.toFixed(2)}.`,
      is_read: false,
    }).catch(() => null);

    return Response.json({
      success: true,
      order_id: (order as any).id,
      face_usd: Math.round(faceUsd * 100) / 100,
      points_applied: pointsApplied,
      points_usd: pointsUsd,
      card_charge_usd: cardNet,
      paid_in_full_by_points: paidNow,
      paypal_order_id: paypalOrderId,
      approve_url: approveUrl,                 // redirect the buyer here to pay the card remainder
      paypal_configured: paypalConfigured(),
      message: pointsApplied > 0
        ? `You applied ${pointsApplied.toLocaleString()} points ($${pointsUsd.toFixed(2)}); your card covers the remaining $${cardNet.toFixed(2)}.`
        : `Your card covers $${cardNet.toFixed(2)}.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
