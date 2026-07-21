import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const entry = data;
    if (!entry?.id || event?.type !== 'update') return Response.json({ ok: true });

    const oldRank = old_data?.rank;
    const newRank = entry.rank;

    if (!newRank || !oldRank || newRank === oldRank) return Response.json({ ok: true });

    const improved = newRank < oldRank;
    const userId = entry.user_id;
    if (!userId) return Response.json({ ok: true });

    // Only notify for significant rank changes or top positions
    const isTop = newRank <= 10;
    const bigJump = Math.abs(oldRank - newRank) >= 5;

    if (isTop || bigJump) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        type: 'leaderboard_rank_change',
        title: improved
          ? `📈 You Moved Up to Rank #${newRank}!`
          : `📉 You Dropped to Rank #${newRank}`,
        message: improved
          ? `${isTop ? '🏆 TOP 10! ' : ''}You climbed from #${oldRank} to #${newRank} on the leaderboard! Keep earning to reach the top!`
          : `You dropped from #${oldRank} to #${newRank}. Complete more surveys and challenges to climb back up!`,
        is_read: false
      });
    }

    // Award XP for hitting top 3
    if (newRank <= 3 && oldRank > 3) {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: userId,
        activity_type: 'leaderboard_top3',
        points_earned: newRank === 1 ? 200 : newRank === 2 ? 150 : 100,
        metadata: { rank: newRank, leaderboard_type: entry.leaderboard_type }
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});