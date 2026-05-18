import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const activity = data;
    if (!activity?.id || !activity?.user_id || !activity?.points_earned) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Get or create UserLevel record
      const levels = await base44.asServiceRole.entities.UserLevel.filter({ user_id: activity.user_id });
      const xpPerLevel = 500;

      if (levels.length === 0) {
        // Create initial level record
        await base44.asServiceRole.entities.UserLevel.create({
          user_id: activity.user_id,
          level: 1,
          total_xp: activity.points_earned,
          xp_to_next_level: xpPerLevel - activity.points_earned
        });
      } else {
        const current = levels[0];
        const newTotalXP = (current.total_xp || 0) + activity.points_earned;
        const newLevel = Math.floor(newTotalXP / xpPerLevel) + 1;
        const xpToNext = (newLevel * xpPerLevel) - newTotalXP;

        await base44.asServiceRole.entities.UserLevel.update(current.id, {
          total_xp: newTotalXP,
          level: newLevel,
          xp_to_next_level: xpToNext,
          last_activity_at: new Date().toISOString()
        });
        // Level-up notification handled by autoUserLevelLifecycle automation
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});