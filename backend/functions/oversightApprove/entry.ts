import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { runApproved } from "../../sdk/oversight.ts";

// Human approves a queued agent action. Marks the AutomationReview approved, then
// RE-INVOKES the original action with an approvalToken so it passes the oversight gate
// and actually executes. Reuses the existing in-process functions.invoke — no new infra.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'developer'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: admin approval required' }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return Response.json({ error: 'Missing review id' }, { status: 400 });

    const rev = await base44.asServiceRole.entities.AutomationReview.get(id);
    if (!rev) return Response.json({ error: 'Review not found' }, { status: 404 });
    if (rev.status !== 'pending_approval') {
      return Response.json({ error: `Already ${rev.status}`, status: rev.status }, { status: 409 });
    }

    await base44.asServiceRole.entities.AutomationReview.update(id, {
      status: 'approved',
      approved_by: user.id,
      approved_by_email: user.email,
      approved_at: new Date().toISOString(),
    });

    // Execute the original action, now carrying the approval token.
    let result: unknown = null;
    try {
      result = await runApproved(() =>
        base44.asServiceRole.functions.invoke(rev.action, {
          ...(rev.payload ?? {}),
          approvalToken: id,
        })
      );
      await base44.asServiceRole.entities.AutomationReview.update(id, {
        status: 'executed',
        executed_at: new Date().toISOString(),
      });
    } catch (e) {
      await base44.asServiceRole.entities.AutomationReview.update(id, {
        status: 'approved_execution_failed',
        error_message: (e as Error).message,
      });
      return Response.json({ ok: false, status: 'approved_execution_failed', error: (e as Error).message }, { status: 500 });
    }

    return Response.json({ ok: true, status: 'executed', result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
