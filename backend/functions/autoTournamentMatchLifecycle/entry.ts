import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const match = data;
    if (!match?.id) return Response.json({ ok: true });

    if (event?.type === 'create' && match.player1_id && match.player2_id) {
      // Notify both players of scheduled match
      const matchTime = match.scheduled_start ? new Date(match.scheduled_start).toLocaleString() : 'Soon';
      for (const playerId of [match.player1_id, match.player2_id]) {
        const opponent = playerId === match.player1_id ? match.player2_name : match.player1_name;
        await base44.asServiceRole.entities.Notification.create({
          user_id: playerId,
          type: 'tournament_match_scheduled',
          title: `⚔️ Tournament Match Scheduled!`,
          message: `Your match vs ${opponent} in Round ${match.round_number} is scheduled for ${matchTime}. Be ready!`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = match.status;

      if (newStatus === 'completed' && oldStatus !== 'completed' && match.winner_id) {
        // Notify winner and loser
        const loserId = match.winner_id === match.player1_id ? match.player2_id : match.player1_id;
        const loserName = match.winner_id === match.player1_id ? match.player2_name : match.player1_name;

        await base44.asServiceRole.entities.Notification.create({
          user_id: match.winner_id,
          type: 'tournament_match_won',
          title: `🏆 Match Won! You advance to the next round.`,
          message: `You defeated ${loserName} ${match.player1_score || 0}-${match.player2_score || 0} in Round ${match.round_number}!`,
          is_read: false
        });

        if (loserId) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: loserId,
            type: 'tournament_match_lost',
            title: `Tournament Match — Better Luck Next Time`,
            message: `You were eliminated in Round ${match.round_number}. Great effort — enter the next tournament for another shot!`,
            is_read: false
          });
        }

        // Award XP to winner
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: match.winner_id,
          activity_type: 'tournament_match_won',
          points_earned: 50,
          metadata: { match_id: match.id, round: match.round_number }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});