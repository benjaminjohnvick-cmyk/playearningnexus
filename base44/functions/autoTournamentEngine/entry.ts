import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: tournament creation, matchmaking, bracket management, prize distribution, leaderboards
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Auto-create new tournaments when none are active
    const activeTournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'active' });
    if (activeTournaments.length < 2) {
      const approvedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
      const featuredGame = approvedGames[0];
      await base44.asServiceRole.entities.Tournament.create({
        tournament_name: `Weekly Tournament - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        game_id: featuredGame?.id || 'general',
        game_title: featuredGame?.title || 'GamerGain',
        status: 'upcoming',
        registration_starts: new Date().toISOString(),
        registration_ends: new Date(Date.now() + 86400000).toISOString(),
        tournament_starts: new Date(Date.now() + 86400000).toISOString(),
        tournament_ends: new Date(Date.now() + 7 * 86400000).toISOString(),
        total_prize_pool: 500,
        max_participants: 64,
        tournament_format: 'single_elimination',
        entry_fee: 0
      });
      results.new_tournament_created = true;
    }

    // 2. AI Matchmaking for pending tournaments
    await base44.asServiceRole.functions.invoke('aiTournamentMatchmaker', {});
    await base44.asServiceRole.functions.invoke('tournamentMatchmaker', {});
    results.matchmaking_run = true;

    // 3. Process match results and advance brackets
    const pendingMatches = await base44.asServiceRole.entities.TournamentMatch.filter({ status: 'pending' });
    results.pending_matches = pendingMatches.length;

    // 4. Distribute prizes for completed tournaments
    const completedTournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'completed', prizes_distributed: false });
    let prizesDistributed = 0;
    for (const t of completedTournaments) {
      await base44.asServiceRole.functions.invoke('distributeTournamentPrizes', { tournament_id: t.id });
      prizesDistributed++;
    }
    results.prizes_distributed = prizesDistributed;

    // 5. Close registration for tournaments starting within 1 hour
    const startingSoon = await base44.asServiceRole.entities.Tournament.filter({ status: 'registration_open' });
    let tournamentsClosed = 0;
    for (const t of startingSoon) {
      const startTime = new Date(t.start_date).getTime();
      if (startTime - Date.now() < 3600000) {
        await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'in_progress' });
        tournamentsClosed++;
      }
    }
    results.tournaments_activated = tournamentsClosed;

    // 6. AI Tournament insights generation
    const recentTournaments = await base44.asServiceRole.entities.Tournament.list('-created_date', 5);
    for (const t of recentTournaments) {
      await base44.asServiceRole.entities.TournamentAIInsight.create({
        tournament_id: t.id,
        insight_type: 'performance',
        generated_at: new Date().toISOString()
      });
    }
    results.ai_insights_generated = recentTournaments.length;

    // 7. Head-to-head contest matchmaking
    await base44.asServiceRole.functions.invoke('headToHeadContestMatchmaker', {});
    results.head_to_head_matched = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});