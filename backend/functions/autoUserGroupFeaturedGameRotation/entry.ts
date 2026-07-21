import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Weekly: rotate featured games across all UserGroups based on performance + dev contracts
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = [];

    const groups = await base44.asServiceRole.entities.UserGroup.filter({ is_active: true });
    const approvedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    const featuredGames = await base44.asServiceRole.entities.Game.filter({ status: 'featured' });
    const allEligible = [...approvedGames, ...featuredGames];

    // Score games: priority payment > installs > rating
    const scored = allEligible.map(g => ({
      ...g,
      score: (g.priority_payment ? 10000 : 0) +
             (g.total_installs || 0) * 0.01 +
             (g.average_rating || 0) * 100
    })).sort((a, b) => b.score - a.score);

    for (const group of groups) {
      // Check if current featured game's 6-day window has expired
      const featuredStart = group.featured_game_start_date ? new Date(group.featured_game_start_date) : null;
      const daysSinceFeatured = featuredStart ? (now - featuredStart) / (1000 * 60 * 60 * 24) : 99;

      if (daysSinceFeatured < 6) continue; // Still within feature window

      // Pick a game not currently featured in another group
      const currentFeaturedIds = new Set(groups.map(g => g.current_featured_game_id).filter(Boolean));
      const nextGame = scored.find(g => !currentFeaturedIds.has(g.id));
      if (!nextGame) continue;

      // Expire old featured game
      if (group.current_featured_game_id) {
        const oldGame = (await base44.asServiceRole.entities.Game.filter({ id: group.current_featured_game_id }))[0];
        if (oldGame && oldGame.status === 'featured') {
          await base44.asServiceRole.entities.Game.update(group.current_featured_game_id, {
            status: 'library',
            featured_end_date: now.toISOString().split('T')[0]
          });
        }
      }

      // Set new featured game
      await base44.asServiceRole.entities.UserGroup.update(group.id, {
        current_featured_game_id: nextGame.id,
        featured_game_start_date: now.toISOString().split('T')[0]
      });

      await base44.asServiceRole.entities.Game.update(nextGame.id, {
        status: 'featured',
        user_group_id: group.id,
        featured_start_date: now.toISOString().split('T')[0],
        featured_end_date: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      // Notify developer their game is now featured
      if (nextGame.developer_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: nextGame.developer_id,
          type: 'game_featured',
          title: `🌟 "${nextGame.title}" Is Now Featured!`,
          message: `Your game is now featured for Group ${group.group_number} (${group.current_users || 0} users) for the next 6 days!`,
          is_read: false
        });
      }

      results.push({ group_id: group.id, game_id: nextGame.id, game_title: nextGame.title });
    }

    return Response.json({ ok: true, rotations: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});