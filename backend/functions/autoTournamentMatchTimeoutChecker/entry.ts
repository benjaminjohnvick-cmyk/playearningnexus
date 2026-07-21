import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Hourly: escalate stalled tournament matches and send pre-match reminders
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = [];

    // Escalate matches stuck in_progress for > 2 hours
    const inProgress = await base44.asServiceRole.entities.TournamentMatch.filter({ status: 'in_progress' });
    for (const match of inProgress) {
      const startedAt = match.actual_start ? new Date(match.actual_start) : new Date(match.scheduled_start || 0);
      const hoursElapsed = (now - startedAt) / (1000 * 60 * 60);
      if (hoursElapsed > 2) {
        await base44.asServiceRole.entities.TournamentMatch.update(match.id, { status: 'cancelled' });
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 1)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'tournament_match_stalled',
            title: `⚠️ Tournament Match Stalled & Cancelled`,
            message: `Match ${match.id} (Round ${match.round_number}) was in_progress for ${Math.floor(hoursElapsed)}h and auto-cancelled.`,
            is_read: false
          });
        }
        results.push(`cancelled_stalled_match_${match.id}`);
      }
    }

    // Send 15-min reminders for upcoming matches
    const pending = await base44.asServiceRole.entities.TournamentMatch.filter({ status: 'pending' });
    for (const match of pending) {
      if (!match.scheduled_start) continue;
      const minutesUntil = (new Date(match.scheduled_start) - now) / (1000 * 60);
      if (minutesUntil > 0 && minutesUntil <= 15) {
        for (const playerId of [match.player1_id, match.player2_id].filter(Boolean)) {
          const opponent = playerId === match.player1_id ? match.player2_name : match.player1_name;
          await base44.asServiceRole.entities.Notification.create({
            user_id: playerId,
            type: 'tournament_match_reminder',
            title: `⏰ Match Starting in ~15 Minutes!`,
            message: `Your tournament match vs ${opponent} starts soon. Get ready!`,
            is_read: false
          });
        }
        results.push(`reminded_match_${match.id}`);
      }
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});