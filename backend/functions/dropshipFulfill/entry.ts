import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { placeDropshipOrder, type SupplierConfig } from "../../sdk/dropship.ts";

// dropshipFulfill (INTERNAL/ADMIN) — places the real supplier order for a PAID dropship order via the
// connected supplier's API (full automation). If the supplier isn't connected, it drops to the buying desk
// so the order is never lost. Idempotent: won't re-place an already-fulfilled order.
//   Body: { order_id }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return Response.json({ error: "order_id required" }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.filter({ id: order_id }).then((r: any) => r[0]);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    if (order.supplier_order_id) return Response.json({ success: true, already: true, supplier_order_id: order.supplier_order_id });

    const supplier = order.supplier_id ? await base44.asServiceRole.entities.Supplier.filter({ id: order.supplier_id }).then((r: any) => r[0]) : null;
    const cfg = supplier ? ({ id: String(supplier.id), name: String(supplier.name || "supplier"), api_base: String(supplier.api_base || ""), api_key_env: String(supplier.api_key_env || ""), order_path: supplier.order_path as string, active: supplier.active !== false }) as SupplierConfig : null;

    const result = cfg ? await placeDropshipOrder(cfg, { item: { title: order.item_name, sku: order.item_sku, price_usd: Number(order.amount) || 0 }, shipping: order.shipping_address || {}, ref: String(order.id) }) : { placed: false, supplier_order_id: null, tracking: null, status: "no_supplier", reason: "No connected supplier for this order." };

    if (result.placed) {
      await db.update("Order", String(order.id), { supplier_order_id: result.supplier_order_id, tracking: result.tracking, status: "awaiting_shipment", fulfillment_status: "placed_with_supplier" }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({ user_id: order.user_id, type: "order_fulfilled", title: "📦 Order placed", message: `"${order.item_name}" is being fulfilled by our supplier.${result.tracking ? ` Tracking: ${result.tracking}` : ""}`, is_read: false }).catch(() => null);
      return Response.json({ success: true, placed: true, supplier_order_id: result.supplier_order_id, tracking: result.tracking });
    }

    // Supplier not connected / rejected → don't lose the order: queue the manual buying desk.
    await base44.asServiceRole.entities.BuyingDeskTask.create({ user_id: order.user_id, order_id: order.id, item: { title: order.item_name, sku: order.item_sku, price_usd: Number(order.amount) || 0 }, shipping: order.shipping_address || null, status: "pending", reason: result.reason || result.status, created_at: new Date().toISOString() }).catch(() => null);
    await db.update("Order", String(order.id), { fulfillment_status: "queued_buying_desk" }).catch(() => null);
    return Response.json({ success: true, placed: false, fell_back: "buying_desk", reason: result.reason || result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
