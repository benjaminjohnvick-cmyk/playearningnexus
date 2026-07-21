import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tournament_id } = await req.json();
    if (!tournament_id) return Response.json({ error: 'Missing tournament_id' }, { status: 400 });

    // Get tournament
    const tournament = await base44.asServiceRole.entities.Tournament.filter({ id: tournament_id }).then(r => r[0]);
    if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    // Check if registration is open
    const now = new Date();
    if (new Date(tournament.registration_ends) < now) {
      return Response.json({ error: 'Registration closed' }, { status: 400 });
    }

    // Check if already registered
    const existing = await base44.asServiceRole.entities.TournamentParticipant.filter({
      tournament_id,
      user_id: user.id,
    });

    if (existing.length > 0) {
      return Response.json({ error: 'Already registered' }, { status: 400 });
    }

    // Check capacity
    if (tournament.current_participants >= tournament.max_participants) {
      return Response.json({ error: 'Tournament full' }, { status: 400 });
    }

    // Deduct entry fee if applicable
    let entryFeePaid = false;
    if (tournament.entry_fee > 0) {
      if (user.total_earnings < tournament.entry_fee) {
        return Response.json({ error: 'Insufficient balance for entry fee' }, { status: 400 });
      }
      entryFeePaid = true;
    }

    // Create participant record
    const participant = await base44.asServiceRole.entities.TournamentParticipant.create({
      tournament_id,
      user_id: user.id,
      user_name: user.full_name,
      user_email: user.email,
      entry_fee_paid: entryFeePaid,
      seed_number: tournament.current_participants + 1,
      registered_at: new Date().toISOString(),
    });

    // Update tournament participant count and prize pool
    const newPrizePool = tournament.total_prize_pool + tournament.entry_fee;
    await base44.asServiceRole.entities.Tournament.update(tournament_id, {
      current_participants: tournament.current_participants + 1,
      total_prize_pool: newPrizePool,
    });

    // Create leaderboard entry
    await base44.asServiceRole.entities.TournamentLeaderboard.create({
      tournament_id,
      user_id: user.id,
      user_name: user.full_name,
      rank: tournament.current_participants + 1,
      updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      participant_id: participant.id,
      tournament_name: tournament.tournament_name,
      entry_fee_paid: entryFeePaid,
      seed: participant.seed_number,
      total_prize_pool: newPrizePool,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});