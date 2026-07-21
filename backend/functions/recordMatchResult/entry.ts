import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { match_id, winner_id, player1_score, player2_score } = await req.json();
    if (!match_id || !winner_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get match
    const match = await base44.asServiceRole.entities.TournamentMatch.filter({ id: match_id }).then(r => r[0]);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    // Only tournament admin or players can submit results
    const isAdmin = user.role === 'admin';
    const isPlayer = winner_id === user.id || match.player1_id === user.id || match.player2_id === user.id;
    if (!isAdmin && !isPlayer) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get loser
    const loserId = winner_id === match.player1_id ? match.player2_id : match.player1_id;
    const loserName = winner_id === match.player1_id ? match.player2_name : match.player1_name;

    // Update match
    await base44.asServiceRole.entities.TournamentMatch.update(match_id, {
      winner_id,
      winner_name: winner_id === match.player1_id ? match.player1_name : match.player2_name,
      player1_score,
      player2_score,
      completed_at: new Date().toISOString(),
      status: 'completed',
      is_live: false,
    });

    // Update participant records
    const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({
      tournament_id: match.tournament_id,
    });

    const winnerParticipant = participants.find(p => p.user_id === winner_id);
    const loserParticipant = participants.find(p => p.user_id === loserId);

    if (winnerParticipant) {
      await base44.asServiceRole.entities.TournamentParticipant.update(winnerParticipant.id, {
        wins: (winnerParticipant.wins || 0) + 1,
        current_round: match.round_number + 1,
      });
    }

    if (loserParticipant) {
      await base44.asServiceRole.entities.TournamentParticipant.update(loserParticipant.id, {
        losses: (loserParticipant.losses || 0) + 1,
        status: 'eliminated',
        final_placement: loserParticipant.current_round === 1 ? participants.length : loserParticipant.current_round,
      });
    }

    // Update leaderboards
    const leaderboards = await base44.asServiceRole.entities.TournamentLeaderboard.filter({
      tournament_id: match.tournament_id,
    });

    const winnerLb = leaderboards.find(l => l.user_id === winner_id);
    const loserLb = leaderboards.find(l => l.user_id === loserId);

    if (winnerLb) {
      await base44.asServiceRole.entities.TournamentLeaderboard.update(winnerLb.id, {
        wins: (winnerLb.wins || 0) + 1,
        streak: (winnerLb.streak || 0) + 1,
        total_score: (winnerLb.total_score || 0) + (player1_score || 0),
        last_match_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (loserLb) {
      await base44.asServiceRole.entities.TournamentLeaderboard.update(loserLb.id, {
        losses: (loserLb.losses || 0) + 1,
        streak: 0,
        total_score: (loserLb.total_score || 0) + (player2_score || 0),
        last_match_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      match_id,
      winner_id,
      winner_name: winnerParticipant?.user_name,
      loser_id: loserId,
      loser_name: loserName,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});