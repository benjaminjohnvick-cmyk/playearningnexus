import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { squad_name, description } = await req.json();
    if (!squad_name) return Response.json({ error: 'Squad name required' }, { status: 400 });

    // Generate unique squad code
    const squadCode = `SQUAD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const squad = await base44.entities.ReferralSquad.create({
      squad_name,
      squad_code: squadCode,
      description: description || '',
      leader_user_id: user.id,
      leader_name: user.full_name,
      member_ids: [user.id],
      member_count: 1,
      created_at: new Date().toISOString(),
      status: 'active',
    });

    // Add leader as member
    await base44.entities.SquadMember.create({
      squad_id: squad.id,
      user_id: user.id,
      user_name: user.full_name,
      user_email: user.email,
      joined_at: new Date().toISOString(),
      is_leader: true,
      status: 'active',
    });

    // Log activity
    await base44.entities.SquadActivityFeed.create({
      squad_id: squad.id,
      event_type: 'member_joined',
      actor_user_id: user.id,
      actor_name: user.full_name,
      message: `${user.full_name} created the squad!`,
      created_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      squad,
      squad_code: squadCode,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});