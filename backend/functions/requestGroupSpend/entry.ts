import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Requests to spend from the group pool — a large-ticket purchase or a transfer
// to a member. If the requester is the group owner, it executes immediately;
// otherwise it is created as pending for owner approval (approveGroupSpend).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { group_id, type = 'purchase', amount, item_name = '', recipient_user_id = '' } = await req.json();
    const amt = Number(amount);
    if (!group_id || !(amt > 0)) return Response.json({ error: 'group_id and a positive amount are required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (!(group.member_ids || []).includes(user.id)) {
      return Response.json({ error: 'You are not a member of this group' }, { status: 403 });
    }
    if ((group.pooled_balance || 0) < amt) {
      return Response.json({ error: 'Insufficient pool balance', pooled_balance: group.pooled_balance || 0 }, { status: 402 });
    }
    if (type === 'transfer' && !(group.member_ids || []).includes(recipient_user_id)) {
      return Response.json({ error: 'Transfer recipient must be a group member' }, { status: 400 });
    }

    const isOwner = user.id === group.owner_user_id;
    const request = await base44.asServiceRole.entities.GroupSpendRequest.create({
      group_id: group.id, requested_by: user.id, requester_name: user.full_name || '',
      type, item_name, recipient_user_id, amount: amt,
      status: isOwner ? 'approved' : 'pending',
    });

    if (isOwner) {
      const execRes = await execute(base44, group, request);
      return Response.json({ success: true, executed: true, ...execRes });
    }

    // Notify the owner to approve.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: group.owner_user_id,
        title: '💳 Group spend request',
        message: `${user.full_name || 'A member'} requested $${amt} for ${type === 'transfer' ? 'a transfer' : (item_name || 'a purchase')}. Approve it in your group.`,
        notification_type: 'group_spend_request',
        related_entity_id: request.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, executed: false, request_id: request.id, status: 'pending' });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to request spend' }, { status: 500 });
  }
});

async function execute(base44: any, group: any, request: any) {
  const amt = request.amount;
  // Debit the pool.
  await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
    pooled_balance: (group.pooled_balance || 0) - amt,
  });
  // For a transfer, credit the recipient member's balance.
  if (request.type === 'transfer' && request.recipient_user_id) {
    try {
      const recips = await base44.asServiceRole.entities.User.filter({ id: request.recipient_user_id });
      if (recips[0]) {
        await base44.asServiceRole.entities.User.update(recips[0].id, { virtual_currency: (recips[0].virtual_currency || 0) + amt });
      }
    } catch { /* non-fatal */ }
  }
  await base44.asServiceRole.entities.GroupSpendRequest.update(request.id, {
    status: 'paid', resolved_at: new Date().toISOString(),
  });
  return { pooled_balance: (group.pooled_balance || 0) - amt };
}
