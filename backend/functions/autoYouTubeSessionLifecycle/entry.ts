import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const session = data;
    if (!session?.id) return Response.json({ ok: true });

    if (event?.type === 'update') {
      const wasCompleted = old_data?.status !== 'completed' && data.status === 'completed';
      const watchPercent = session.watch_percentage || 0;

      if (wasCompleted && session.user_id) {
        // Award XP based on watch percentage
        const xpEarned = watchPercent >= 90 ? 30 : watchPercent >= 50 ? 15 : 5;
        const earningsBonus = watchPercent >= 90 ? 0.05 : 0;

        await base44.asServiceRole.entities.UserActivity.create({
          user_id: session.user_id,
          activity_type: 'youtube_video_watched',
          points_earned: xpEarned,
          metadata: {
            video_id: session.video_id,
            watch_percent: watchPercent,
            earnings_bonus: earningsBonus
          }
        });

        if (earningsBonus > 0) {
          const user = (await base44.asServiceRole.entities.User.filter({ id: session.user_id }))[0];
          if (user) {
            await base44.asServiceRole.entities.User.update(session.user_id, {
              total_earnings: (user.total_earnings || 0) + earningsBonus
            });
            await base44.asServiceRole.entities.Notification.create({
              user_id: session.user_id,
              type: 'video_reward',
              title: `🎬 Video Watch Reward: +$${earningsBonus}!`,
              message: `You watched ${watchPercent}% of the video and earned $${earningsBonus} + ${xpEarned} XP!`,
              is_read: false
            });
          }
        }

        // Update analytics
        await base44.asServiceRole.entities.YouTubeVideoSession.update(session.id, {
          xp_awarded: xpEarned,
          earnings_awarded: earningsBonus
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});