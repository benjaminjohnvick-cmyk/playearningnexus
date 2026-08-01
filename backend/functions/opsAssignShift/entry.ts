import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";

// opsAssignShift (INTERNAL/ADMIN) — assign a paid operator (staff/contractor) a recurring UTC coverage
// window for the batch-approval desk, or deactivate one. Operators run the company's own fulfillment.
//   Body: { operator_user_id?, operator_name, tz?, start_hour_utc, end_hour_utc, days?:[0-6], active?, shift_id? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const shift = {
      operator_user_id: body.operator_user_id ? String(body.operator_user_id) : null,
      operator_name: String(body.operator_name || "Operator").slice(0, 120),
      tz: String(body.tz || "UTC").slice(0, 60),
      start_hour_utc: Math.max(0, Math.min(23, Math.floor(Number(body.start_hour_utc) || 0))),
      end_hour_utc: Math.max(0, Math.min(23, Math.floor(Number(body.end_hour_utc) || 0))),
      days: Array.isArray(body.days) ? body.days.map((d: unknown) => Math.max(0, Math.min(6, Math.floor(Number(d) || 0)))) : [],
      active: body.active === undefined ? true : !!body.active,
    };

    if (body.shift_id) {
      await db.update("OpsShift", String(body.shift_id), shift).catch(() => null);
      return Response.json({ success: true, shift_id: body.shift_id, updated: true });
    }
    const created = await base44.asServiceRole.entities.OpsShift.create(shift);
    return Response.json({ success: true, shift_id: created.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
