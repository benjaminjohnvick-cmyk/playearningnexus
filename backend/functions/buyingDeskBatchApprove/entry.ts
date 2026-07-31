import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";

// buyingDeskBatchApprove (INTERNAL/ADMIN) — a team member has placed these orders at the retailer(s) by
// hand; mark the tasks placed and move their orders to awaiting_shipment (optionally with tracking). One
// click clears a whole batch. Idempotent per task.
//   Body: { task_ids: [...], mark = "placed", tracking_by_task?: { [task_id]: tracking } }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.task_ids) ? body.task_ids.map(String) : [];
    if (!ids.length) return Response.json({ error: "task_ids required" }, { status: 400 });
    const mark = String(body.mark || "placed");
    const trackingBy: Record<string, string> = body.tracking_by_task || {};

    let updated = 0;
    for (const id of ids) {
      const t = await db.get("BuyingDeskTask", id).catch(() => null) as Record<string, unknown> | null;
      if (!t || t.status === "placed") continue;
      await db.update("BuyingDeskTask", id, { status: mark, placed_at: new Date().toISOString(), tracking: trackingBy[id] || null }).catch(() => null);
      if (t.order_id) {
        await db.update("Order", String(t.order_id), { status: "awaiting_shipment", payment_captured: true, fulfillment_status: "placed_by_desk", tracking: trackingBy[id] || null }).catch(() => null);
        await base44.asServiceRole.entities.Notification.create({ user_id: t.user_id, type: "order_fulfilled", title: "📦 Order placed", message: `Your order was placed${trackingBy[id] ? ` — tracking: ${trackingBy[id]}` : ""}.`, is_read: false }).catch(() => null);
      }
      updated++;
    }
    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
