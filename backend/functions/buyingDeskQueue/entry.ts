import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";

// buyingDeskQueue (INTERNAL/ADMIN) — the manual fallback queue: orders with no sanctioned auto-channel that a
// team member places by hand. Returns pending tasks for the buying-desk UI (batch-approvable).
//   Body: { status? = "pending", limit? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const status = String(body.status || "pending");
    const limit = Math.max(1, Math.min(500, Number(body.limit) || 200));
    const tasks = await db.filter("BuyingDeskTask", { status }, "-created_date", limit).catch(() => []) as Record<string, unknown>[];
    return Response.json({
      status, count: (tasks || []).length,
      tasks: (tasks || []).map((t) => ({ id: t.id, user_id: t.user_id, order_id: t.order_id, item: t.item, shipping: t.shipping, reason: t.reason || null, created_at: t.created_at })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
