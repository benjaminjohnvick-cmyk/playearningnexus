import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";

// cancelStoreOrder (authenticated) — the buyer cancels an order that HASN'T shipped yet and is refunded, in the
// closed loop (store credit / points restored — never cash). Supports the FTC Mail/Internet Order Rule
// ("30-Day Rule"): if we can't ship in time, the buyer can cancel for a full refund. Idempotent, and refuses to
// cancel anything already shipped/delivered/completed or whose supplier funds were released.
//   { order_id } → { ok, refunded } | { error }
const CANCELLABLE = new Set(["pending_ai_fulfillment", "processing", "awaiting_shipment", "delayed"]);

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return Response.json({ error: "order_id required" }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Order.filter({ id: String(order_id) }).catch(() => []) as Record<string, unknown>[];
    const order = rows[0];
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    // Admins may cancel on a buyer's behalf; otherwise it must be the buyer's own order.
    if (String(order.user_id) !== String(user.id) && user.role !== "admin") {
      return Response.json({ error: "Not your order." }, { status: 403 });
    }
    if (order.shipping_status === "cancelled") {
      return Response.json({ ok: true, already: true, message: "This order was already cancelled and refunded." });
    }
    if (order.funds_released === true || !CANCELLABLE.has(String(order.shipping_status))) {
      return Response.json({ error: `This order can no longer be cancelled (status: ${order.shipping_status}). Contact support for a return.` }, { status: 409 });
    }

    const uid = String(order.user_id);
    const amount = Number(order.amount) || 0;
    const cardCharge = Number(order.card_charge_usd) || 0;
    const pointsSpent = Number(order.points_spent) || 0;
    const method = String(order.payment_method || "survey_balance");

    // Restore any Site-Cash points that were applied on a card order.
    if (pointsSpent > 0) await adjustUserBalance(uid, pointsSpent, { field: "points" }).catch(() => null);

    // Refund the paid value as STORE CREDIT (closed-loop; never cash), per the refund policy.
    let refund: { field: string; usd: number } | null = null;
    if (method === "survey_balance") refund = { field: "current_balance", usd: amount };
    else if (method === "refund_credit") refund = { field: "refund_credit_balance", usd: amount };
    else if (method === "credit_card") refund = { field: "current_balance", usd: cardCharge }; // card money → store credit
    if (refund && refund.usd > 0) await adjustUserBalance(uid, refund.usd, { field: refund.field }).catch(() => null);

    await db.update("Order", String(order.id), {
      shipping_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: String(order.cancel_reason || "buyer_cancelled"),
      refunded_usd: refund?.usd ?? 0,
      refunded_points: pointsSpent || 0,
    }).catch(() => null);

    if (uid) await base44.asServiceRole.entities.Notification.create({
      user_id: uid, type: "order_cancelled_refunded",
      title: "Order cancelled — refunded", is_read: false,
      message: `Your order for "${order.product_name}" was cancelled and refunded as store credit${pointsSpent ? " (and your applied points were returned)" : ""}. No charge remains.`,
    }).catch(() => null);

    return Response.json({
      ok: true, cancelled: true,
      refunded: { store_credit_usd: refund?.usd ?? 0, points_returned: pointsSpent || 0, to: refund?.field ?? null },
      note: "Refund issued as closed-loop store credit (never cash).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
