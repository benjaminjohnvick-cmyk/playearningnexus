import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Human rejects a queued agent action. The action never executes; the record is kept
// for audit. Reuses the existing AutomationReview entity.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'developer'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin approval required' }, { status: 403 });
    }
    const { id, reason } = await req.json();
    if (!id) return Response.json({ error: 'Missing review id' }, { status: 400 });

    const rev = await base44.asServiceRole.entities.AutomationReview.get(id);
    if (!rev) return Response.json({ error: 'Review not found' }, { status: 404 });
    if (rev.status !== 'pending_approval') {
      return Response.json({ error: `Already ${rev.status}`, status: rev.status }, { status: 409 });
    }

    await base44.asServiceRole.entities.AutomationReview.update(id, {
      status: 'rejected',
      rejected_by: user.id,
      rejected_by_email: user.email,
      reason: reason ?? null,
      rejected_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, status: 'rejected' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
