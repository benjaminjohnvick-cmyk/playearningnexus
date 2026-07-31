import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { paypalConfigured, captureOrder } from "../../sdk/paypal-api.ts";
import { recordMoneyFlow } from "../../sdk/paypal.ts";

// paypalCaptureCheckout (authenticated) — capture an approved PayPal payment, mark the order paid, record the
// money-in flow, and kick AI fulfillment. Idempotent: a re-capture on an already-paid order is a no-op.
//   Body: { order_id }  (or { paypal_order_id })
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!paypalConfigured()) return Response.json({ configured: false, message: "PayPal isn't connected yet." });

    const body = await req.json().catch(() => ({}));
    let order = body.order_id
      ? await base44.asServiceRole.entities.Order.filter({ id: body.order_id }).then((r: any) => r[0])
      : body.paypal_order_id
        ? (await base44.asServiceRole.entities.Order.filter({ paypal_order_id: body.paypal_order_id }, "-created_date", 1))[0]
        : null;
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    if (order.user_id !== user.id) return Response.json({ error: "Not your order" }, { status: 403 });
    if (order.payment_captured) return Response.json({ success: true, already: true, order_id: order.id });
    if (!order.paypal_order_id) return Response.json({ error: "This order has no PayPal payment to capture." }, { status: 409 });

    const cap = await captureOrder(String(order.paypal_order_id));
    if (!cap.captured) return Response.json({ captured: false, status: cap.status, message: "Payment not completed yet." }, { status: 409 });

    await db.update("Order", String(order.id), {
      payment_captured: true, status: "awaiting_shipment",
      paypal_capture_id: cap.capture_id, paypal_status: cap.status,
    }).catch(() => null);

    await recordMoneyFlow({ direction: "in", amount_usd: cap.amount_usd || Number(order.amount) || 0, kind: "card_payment", ref: String(order.id), provider: "paypal", meta: { user_id: user.id, capture_id: cap.capture_id } }).catch(() => null);

    // Fulfillment: dropship → place the supplier order; platform catalog → AI engine; member listings →
    // funds-release.
    const fn = order.source === "dropship" ? "dropshipFulfill"
      : (order.source === "platform_catalog" || order.source === "curated") ? "aiOrderFulfillment"
      : "autoOrderFulfillmentAndFundsRelease";
    base44.asServiceRole.functions.invoke(fn, { order_id: order.id }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "marketplace_purchase", title: "✅ Payment received",
      message: `Your payment of $${(cap.amount_usd || Number(order.amount) || 0).toFixed(2)} is complete — your order is being fulfilled.`, is_read: false,
    }).catch(() => null);

    return Response.json({ success: true, order_id: order.id, captured: true, amount_usd: cap.amount_usd, capture_id: cap.capture_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
