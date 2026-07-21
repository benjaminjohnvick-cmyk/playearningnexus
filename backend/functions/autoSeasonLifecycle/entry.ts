import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const season = data;
    if (!season?.id) return Response.json({ ok: true });

    if (event?.type === 'update' && data.status === 'completed') {
      // Season ended — distribute top-100 rewards
      const ranks = await base44.asServiceRole.entities.SeasonRank.filter({ season_id: season.id });
      ranks.sort((a, b) => (a.rank || 999) - (b.rank || 999));

      for (const rank of ranks.slice(0, 100)) {
        // Find matching reward tier
        const reward = (season.top_100_rewards || []).find(r => {
          const [min, max] = (r.rank_range || '').split('-').map(Number);
          return rank.rank >= min && rank.rank <= max;
        });
        if (reward && rank.user_id) {
          await base44.asServiceRole.entities.SeasonRank.update(rank.id, {
            reward_name: reward.reward_name,
            reward_icon: reward.reward_icon,
            reward_claimed: false
          });
          // Cash bonus
          if (reward.reward_type === 'cash_bonus') {
            const user = (await base44.asServiceRole.entities.User.filter({ id: rank.user_id }))[0];
            if (user) {
              await base44.asServiceRole.entities.User.update(rank.user_id, {
                total_earnings: (user.total_earnings || 0) + (reward.bonus_amount || 0)
              });
            }
          }
          // Award badge
          await base44.asServiceRole.entities.UserBadge.create({
            user_id: rank.user_id,
            badge_name: reward.reward_name,
            badge_type: 'season_reward',
            earned_at: new Date().toISOString(),
            season_number: season.season_number
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: rank.user_id,
            type: 'season_reward',
            title: `🏆 Season ${season.season_number} Reward: ${reward.reward_name}!`,
            message: `You finished Season ${season.season_number} at Rank #${rank.rank}! You earned: ${reward.reward_name}`,
            is_read: false
          });
        }
      }

      // Create next season
      await base44.asServiceRole.entities.Season.create({
        season_number: (season.season_number || 0) + 1,
        name: `Season ${(season.season_number || 0) + 1}`,
        status: 'upcoming',
        starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ends_at: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(),
        top_100_rewards: season.top_100_rewards || []
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});