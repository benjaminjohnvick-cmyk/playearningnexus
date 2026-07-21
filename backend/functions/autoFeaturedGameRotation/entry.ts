import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userGroups = await base44.asServiceRole.entities.UserGroup.list('-group_number');
    const now = new Date();
    const rotations = [];

    for (const group of userGroups) {
      if (!group.is_active) continue;

      // Check if rotation is needed (6 days since last featured)
      const daysSince = group.featured_game_start_date
        ? (now - new Date(group.featured_game_start_date)) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSince < 6) continue;

      // Find next game to feature: priority games first, then queue
      const priorityGames = await base44.asServiceRole.entities.Game.filter({ priority_payment: true, status: 'approved' });
      const queuedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' }, 'queue_position');

      const nextGame = priorityGames[0] || queuedGames[0];
      if (!nextGame) continue;

      // Move old featured game to library
      if (group.current_featured_game_id) {
        await base44.asServiceRole.entities.Game.update(group.current_featured_game_id, { status: 'library' });
      }

      // Feature new game
      await base44.asServiceRole.entities.Game.update(nextGame.id, {
        status: 'featured',
        featured_start_date: now.toISOString(),
        featured_end_date: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        user_group_id: group.id,
      });

      await base44.asServiceRole.entities.UserGroup.update(group.id, {
        current_featured_game_id: nextGame.id,
        featured_game_start_date: now.toISOString(),
      });

      rotations.push({ group: group.group_number, game: nextGame.title });
    }

    return Response.json({ ok: true, rotations, checked: userGroups.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});