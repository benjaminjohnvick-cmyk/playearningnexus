import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Batch Game Recommendations
 * Scheduled daily: for each active user, analyze their play history and
 * inject AI-personalized game recommendations as in-app notifications.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allUsers = await base44.asServiceRole.entities.User.list('-updated_date', 200);
    const allGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    const allEngagements = await base44.asServiceRole.entities.GameEngagement.list('-created_date', 5000);

    let recommended = 0;

    for (const user of allUsers) {
      // Only process users active in last 30 days
      const daysSinceActive = (Date.now() - new Date(user.updated_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 30) continue;

      const userEngagements = allEngagements.filter(e => e.user_id === user.id);
      const playedGameIds = new Set(userEngagements.map(e => e.game_id));
      const unplayedGames = allGames.filter(g => !playedGameIds.has(g.id)).slice(0, 15);

      if (unplayedGames.length === 0) continue;

      const genreFreq = userEngagements.reduce((acc, e) => {
        if (e.genre) acc[e.genre] = (acc[e.genre] || 0) + 1;
        return acc;
      }, {});
      const topGenres = Object.entries(genreFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a game recommendation AI for GamerGain. Pick the top 2 games to recommend to this user.

User profile:
- Games played: ${userEngagements.length}
- Preferred genres: ${topGenres.join(', ') || 'unknown'}
- Total earnings: $${(user.total_earnings || 0).toFixed(2)}

Available games:
${unplayedGames.map(g => `- ID:${g.id} | ${g.title} | Genre:${g.category || 'misc'} | Platform:${(g.platform || []).join('/')}`).join('\n')}

Return JSON: { "top_picks": [{ "game_id": "...", "game_title": "...", "reason": "1 short sentence" }] }`,
        response_json_schema: {
          type: 'object',
          properties: {
            top_picks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  game_id: { type: 'string' },
                  game_title: { type: 'string' },
                  reason: { type: 'string' }
                }
              }
            }
          }
        }
      });

      for (const pick of (result.top_picks || []).slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'recommendation',
          title: `🎮 You might love: ${pick.game_title}`,
          message: pick.reason,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/InAppGameStore',
          icon: 'gamepad',
          metadata: { game_id: pick.game_id }
        });
      }

      recommended++;
    }

    return Response.json({ success: true, users_recommended: recommended });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});