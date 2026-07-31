import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { paypalConfigured, createOrder } from "../../sdk/paypal-api.ts";

// paypalCreateCheckout (authenticated) — start a live PayPal payment for an existing order's card amount.
// Returns the approve_url the client redirects the buyer to. Requires PayPal env keys; returns configured:
// false otherwise so the UI can fall back gracefully.
//   Body: { order_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!paypalConfigured()) return Response.json({ configured: false, message: "PayPal isn't connected yet — add your API keys to enable card payments." });

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return Response.json({ error: "order_id required" }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.filter({ id: order_id }).then((r: any) => r[0]);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    if (order.user_id !== user.id) return Response.json({ error: "Not your order" }, { status: 403 });
    const amount = Number(order.amount) || 0;
    if (amount <= 0) return Response.json({ error: "Nothing to charge on this order" }, { status: 400 });

    const pp = await createOrder({ amountUsd: amount, ref: String(order.id), description: order.item_name || "GamerGain order" });
    await db.update("Order", String(order.id), { paypal_order_id: pp.id, paypal_status: pp.status }).catch(() => null);

    return Response.json({ configured: true, paypal_order_id: pp.id, approve_url: pp.approve_url, amount_usd: amount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
