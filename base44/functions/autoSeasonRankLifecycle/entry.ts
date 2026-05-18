import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.entity_name === 'Season' && event?.type === 'create') {
      const season = data;
      // New season → announce to all active users
      const activeUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
      for (const user of activeUsers.slice(0, 20)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'new_season',
          title: `🌟 Season ${season.season_number || ''} Has Begun!`,
          message: `A new competitive season is live! Compete for top rankings and earn exclusive season rewards. Season ends: ${season.end_date || 'TBD'}.`,
          is_read: false
        });
      }
    }

    if (event?.entity_name === 'SeasonRank' && event?.type === 'update') {
      const rank = data;
      // Rank up notification
      if (rank.user_id && rank.rank_tier) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: rank.user_id,
          type: 'rank_up',
          title: `📈 Rank Up! You're now ${rank.rank_tier}`,
          message: `Congratulations! You've climbed to ${rank.rank_tier} this season. Keep going to reach the top!`,
          is_read: false
        });
        // Award badge for rank milestones
        const milestones = ['Diamond', 'Platinum', 'Gold', 'Champion'];
        if (milestones.includes(rank.rank_tier)) {
          await base44.asServiceRole.entities.UserBadge.create({
            user_id: rank.user_id,
            badge_type: `season_rank_${rank.rank_tier.toLowerCase()}`,
            title: `${rank.rank_tier} Season Rank`,
            description: `Reached ${rank.rank_tier} rank in a competitive season`,
            earned_at: new Date().toISOString()
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});