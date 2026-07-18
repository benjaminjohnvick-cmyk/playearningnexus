import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Joins a shared wallet group by invite code.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invite_code } = await req.json();
    if (!invite_code) return Response.json({ error: 'invite_code is required' }, { status: 400 });

    const groups = await base44.asServiceRole.entities.SharedWalletGroup.filter({ invite_code: invite_code.toUpperCase(), status: 'active' });
    const group = groups[0];
    if (!group) return Response.json({ error: 'No active group found for that code' }, { status: 404 });

    const members = group.member_ids || [];
    if (members.includes(user.id)) {
      return Response.json({ success: true, already_member: true, group_id: group.id });
    }
    if (members.length >= (group.max_members || 10)) {
      return Response.json({ error: 'This group is full' }, { status: 409 });
    }

    await base44.asServiceRole.entities.SharedWalletGroup.update(group.id, {
      member_ids: [...members, user.id],
      member_count: members.length + 1,
    });

    // Notify the owner.
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: group.owner_user_id,
        title: '👪 New group member',
        message: `${user.full_name || 'A new member'} joined "${group.name}".`,
        notification_type: 'group_member_joined',
        related_entity_id: group.id,
      });
    } catch { /* non-fatal */ }

    return Response.json({ success: true, group_id: group.id, member_count: members.length + 1 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to join group' }, { status: 500 });
  }
});
