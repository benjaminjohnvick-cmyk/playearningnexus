import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Creates a shared wallet group (e.g. a family pool). The creator becomes the
// owner and first member. Returns an invite code others use to join.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, group_type = 'family', monthly_goal = 0, purpose = '', max_members = 10 } = await req.json();
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    // Short, human-friendly invite code.
    const code = (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'GRP') +
      Math.floor(1000 + Math.random() * 9000);

    const group = await base44.asServiceRole.entities.SharedWalletGroup.create({
      name,
      group_type,
      owner_user_id: user.id,
      member_ids: [user.id],
      member_count: 1,
      max_members,
      invite_code: code,
      monthly_goal,
      purpose,
      pooled_balance: 0,
      status: 'active',
    });

    return Response.json({ success: true, group_id: group.id, invite_code: code });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to create group' }, { status: 500 });
  }
});
