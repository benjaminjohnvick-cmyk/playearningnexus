import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { featureAllowed } from "../../sdk/jurisdiction.ts";
import { getNumber } from "../../sdk/settings.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Compliance (Wave 2): prize competitions are jurisdiction- and age-gated.
    const __jur = user.jurisdiction ?? user.state ?? null;
    if (!featureAllowed("jackpots", __jur)) {
      return Response.json({ error: "Prize competitions aren't available in your location." }, { status: 403 });
    }
    if (user.age_verified_18plus !== true) {
      return Response.json({ error: "You must verify you're 18 or older to enter prize competitions." }, { status: 403 });
    }

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

    // Deduct entry fee if applicable. Per-tournament entry_fee wins; if a tournament
    // sets none, fall back to the admin-adjustable global default (0 = free).
    const entryFee = Number(tournament.entry_fee) > 0
      ? Number(tournament.entry_fee)
      : await getNumber("TOURNAMENT_ENTRY_FEE", 0);
    let entryFeePaid = false;
    if (entryFee > 0) {
      if (user.total_earnings < entryFee) {
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
    const newPrizePool = tournament.total_prize_pool + (entryFeePaid ? entryFee : 0);
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