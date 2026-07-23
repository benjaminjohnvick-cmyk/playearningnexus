import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Lists agent actions awaiting human approval (the overseer's inbox). Reads the existing
// AutomationReview entity so the existing dashboards can render it with no schema change.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'developer'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const status = body?.status ?? 'pending_approval';

    const rows = await base44.asServiceRole.entities.AutomationReview.filter(
      { status, type: 'agent_action' },
      '-created_date',
      body?.limit ?? 200,
    );
    return Response.json({ pending: rows, count: rows.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
