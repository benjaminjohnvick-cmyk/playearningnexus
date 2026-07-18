import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// A member contributes credits from their balance into the group pool.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { group_id, amount } = await req.json();
    const amt = Number(amount);
    if (!group_id || !(amt > 0)) return Response.json({ error: 'group_id and a positive amount are required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ id: group_id });
    const group = groups[0];
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    if (!(group.member_ids || []).includes(user.id)) {
      return Response.json({ error: 'You are not a member of this group' }, { status: 403 });
    }

    const balance = user.virtual_currency || 0;
    if (balance < amt) {
      return Response.json({ error: 'Insufficient balance', balance }, { status: 402 });
    }

    // Move credits from the member to the shared pool.
    await base44.asServiceRole.entities.User.update(user.id, { virtual_currency: balance - amt });
    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      pooled_balance: (group.pooled_balance || 0) + amt,
    });

    const month = new Date().toISOString().slice(0, 7);
    await base44.asServiceRole.entities.GroupContribution.create({
      group_id: group.id, user_id: user.id, user_name: user.full_name || '', amount: amt, month,
    });

    return Response.json({
      success: true,
      pooled_balance: (group.pooled_balance || 0) + amt,
      your_remaining_balance: balance - amt,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to contribute' }, { status: 500 });
  }
});
