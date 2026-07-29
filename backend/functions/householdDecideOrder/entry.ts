import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// householdDecideOrder (holder only) — approve or reject a teen's pending order.
//   approve → the order moves to awaiting_payment so it can be completed (nothing is charged here; card
//             capture is external and points are captured when the teen completes checkout).
//   reject  → the order is marked rejected and the teen is notified.
// Body: { order_id, action: "approve"|"reject", note? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { order_id, action, note } = await req.json().catch(() => ({}));
    if (!order_id || !["approve", "reject"].includes(action)) return Response.json({ error: 'order_id and action ("approve"|"reject") required' }, { status: 400 });

    const [order] = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    if (order.approver_id !== user.id) return Response.json({ error: "That order isn't yours to approve." }, { status: 403 });
    if (order.status !== "pending_approval") return Response.json({ error: `This order is already ${order.status}.` }, { status: 409 });

    const now = new Date().toISOString();
    if (action === "approve") {
      await base44.asServiceRole.entities.Order.update(order.id, {
        status: "awaiting_payment", needs_approval: false, approved_by: user.id, approved_at: now, approval_note: note || null,
      });
      await base44.asServiceRole.entities.Notification.create({
        user_id: order.user_id, type: "household_order_approved",
        title: "✅ Order approved",
        message: `Your household adult approved "${order.item_name}". You can complete it now — it's not charged until you do.`,
        is_read: false,
      }).catch(() => null);
      return Response.json({ ok: true, order_id: order.id, status: "awaiting_payment" });
    }

    await base44.asServiceRole.entities.Order.update(order.id, {
      status: "rejected", needs_approval: false, rejected_by: user.id, rejected_at: now, approval_note: note || null,
    });
    await base44.asServiceRole.entities.Notification.create({
      user_id: order.user_id, type: "household_order_rejected",
      title: "🚫 Order not approved",
      message: `Your household adult didn't approve "${order.item_name}".${note ? ` Note: ${note}` : ""}`,
      is_read: false,
    }).catch(() => null);
    return Response.json({ ok: true, order_id: order.id, status: "rejected" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
