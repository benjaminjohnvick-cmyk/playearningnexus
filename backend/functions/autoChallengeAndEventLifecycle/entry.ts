import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const entityName = event?.entity_name;

    // DailyChallenge created → broadcast to all users
    if (entityName === 'DailyChallenge' && event?.type === 'create') {
      const challenge = data;
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      for (const user of users) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'daily_challenge_new',
          title: `🎯 New Daily Challenge: ${challenge.title || 'Daily Challenge'}!`,
          message: `${challenge.description || 'Complete today\'s challenge'} — Reward: ${challenge.reward || 'XP & Bonus'}. Ends tonight!`,
          is_read: false
        });
      }
    }

    // WeeklyEvent created → broadcast + AI generate promo copy
    if (entityName === 'WeeklyEvent' && event?.type === 'create') {
      const weeklyEvent = data;
      const promo = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a hype notification for this GamerGain weekly event: "${weeklyEvent.title || 'Weekly Event'}" — ${weeklyEvent.description || ''}. Prize: ${weeklyEvent.prize || 'rewards'}. Max 100 chars.`,
        response_json_schema: { type: "object", properties: { message: { type: "string" } } }
      });
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      for (const user of users) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'weekly_event_new',
          title: `🗓️ Weekly Event: ${weeklyEvent.title || 'Event'}!`,
          message: promo.message || `${weeklyEvent.description || 'A new weekly event has started!'}`,
          is_read: false
        });
      }
    }

    // DailyChallenge updated to completed → award winners
    if (entityName === 'DailyChallenge' && event?.type === 'update' && data.status === 'completed') {
      const challenge = data;
      if (challenge.winner_ids?.length > 0) {
        for (const winnerId of challenge.winner_ids.slice(0, 10)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: winnerId,
            type: 'challenge_won',
            title: `🏆 Daily Challenge Complete!`,
            message: `You completed "${challenge.title}"! Your reward has been credited.`,
            is_read: false
          });
          await base44.asServiceRole.entities.UserActivity.create({
            user_id: winnerId,
            activity_type: 'daily_challenge_completed',
            points_earned: challenge.xp_reward || 50,
            metadata: { challenge_id: challenge.id }
          });
        }
      }
    }

    // WeeklyEvent ended → announce results
    if (entityName === 'WeeklyEvent' && event?.type === 'update' && data.status === 'ended') {
      const weeklyEvent = data;
      if (weeklyEvent.winner_id) {
        const winner = (await base44.asServiceRole.entities.User.filter({ id: weeklyEvent.winner_id }))[0];
        const users = await base44.asServiceRole.entities.User.list('-created_date', 30);
        for (const user of users) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'weekly_event_ended',
            title: `🎊 Weekly Event Ended!`,
            message: `"${weeklyEvent.title}" is over! Winner: ${winner?.full_name || 'a top gamer'}. Prize: ${weeklyEvent.prize || 'Reward'}. New event coming soon!`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});