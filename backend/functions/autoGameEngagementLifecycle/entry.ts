import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const engagement = data;
    if (!engagement?.id) return Response.json({ ok: true });

    // Session ended (session_end set for first time)
    const sessionJustEnded = event?.type === 'update' &&
      !old_data?.session_end && data.session_end;

    if (sessionJustEnded && engagement.user_id) {
      const duration = engagement.duration_minutes || 0;
      // XP based on session duration
      const xp = duration >= 30 ? 30 : duration >= 10 ? 15 : duration >= 3 ? 5 : 0;

      if (xp > 0) {
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: engagement.user_id,
          activity_type: 'game_session',
          points_earned: xp,
          metadata: { game_id: engagement.game_id, duration_minutes: duration }
        });

        // Create ActivityFeedItem for longer sessions
        if (duration >= 10) {
          await base44.asServiceRole.entities.ActivityFeedItem.create({
            user_id: engagement.user_id,
            activity_type: 'game_install',
            title: `🎮 Played for ${duration} minutes`,
            description: `Gaming session completed`,
            related_entity_id: engagement.game_id,
            icon: '🎮',
            is_public: true
          });
        }
      }

      // Update game aggregate engagement stats
      if (engagement.game_id) {
        const allSessions = await base44.asServiceRole.entities.GameEngagement.filter({ game_id: engagement.game_id });
        const totalMinutes = allSessions.reduce((s, e) => s + (e.duration_minutes || 0), 0);
        const avgMinutes = allSessions.length > 0 ? totalMinutes / allSessions.length : 0;

        // Update developer notification for milestone sessions
        if (allSessions.length % 100 === 0) {
          const game = (await base44.asServiceRole.entities.Game.filter({ id: engagement.game_id }))[0];
          if (game?.developer_id) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: game.developer_id,
              type: 'game_engagement_milestone',
              title: `🎮 ${allSessions.length} Game Sessions Milestone!`,
              message: `"${game.title}" reached ${allSessions.length} total sessions! Avg session: ${avgMinutes.toFixed(1)} minutes.`,
              is_read: false
            });
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});