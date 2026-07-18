import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Group owner approves (or rejects) a pending spend request and executes it.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { request_id, decision = 'approve' } = await req.json();
    if (!request_id) return Response.json({ error: 'request_id is required' }, { status: 400 });

    const reqs = await base44.asServiceRole.entities.GroupSpendRequest.filter({ id: request_id });
    const request = reqs[0];
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (request.status !== 'pending') return Response.json({ error: `Request already ${request.status}` }, { status: 409 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: request.group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (user.id !== group.owner_user_id) {
      return Response.json({ error: 'Only the group owner can approve spending' }, { status: 403 });
    }

    if (decision === 'reject') {
      await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
        status: 'rejected', approved_by: user.id, resolved_at: new Date().toISOString(),
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    if ((group.pooled_balance || 0) < request.amount) {
      return Response.json({ error: 'Insufficient pool balance', pooled_balance: group.pooled_balance || 0 }, { status: 402 });
    }

    // Debit the pool; for transfers, credit the recipient.
    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      pooled_balance: (group.pooled_balance || 0) - request.amount,
    });
    if (request.type === 'transfer' && request.recipient_user_id) {
      try {
        const recips = await base44.asServiceRole.entities.User.filter({ id: request.recipient_user_id });
        if (recips[0]) {
          await base44.asServiceRole.entities.User.update(recips[0].id, { virtual_currency: (recips[0].virtual_currency || 0) + request.amount });
        }
      } catch { /* non-fatal */ }
    }
    await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
      status: 'paid', approved_by: user.id, resolved_at: new Date().toISOString(),
    });

    // Notify the requester.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: request.requested_by,
        title: '✅ Group spend approved',
        message: `Your $${request.amount} request for "${group.name}" was approved and paid from the pool.`,
        notification_type: 'group_spend_approved',
        related_entity_id: group.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, status: 'paid', pooled_balance: (group.pooled_balance || 0) - request.amount });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to approve spend' }, { status: 500 });
  }
});
