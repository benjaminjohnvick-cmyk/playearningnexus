import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Super Agent 3: GamerGain Tournament & Gamification Manager
 * Orchestrates: calculateGlobalPrestige, computeUserTrustScore,
 * calculateTrustScore (batch), earningVelocityMonitor, milestoneAlertChecker,
 * notifyWeeklyTopEarners, awardUserXP (batch), checkAndAwardBadges,
 * distributeTournamentPrizes (for completed tournaments), dailyTierCheck,
 * updateUserTiers
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const start = Date.now();
    const results = {};
    const errors = {};

    const run = async (name, fn, payload = {}) => {
      try {
        console.log(`[TournamentGamification] Running ${name}...`);
        results[name] = await base44.asServiceRole.functions.invoke(fn, payload);
        console.log(`[TournamentGamification] ✓ ${name}`);
      } catch (e) {
        errors[name] = e.message;
        console.error(`[TournamentGamification] ✗ ${name}: ${e.message}`);
      }
    };

    // === PRESTIGE & TRUST SCORES ===
    await run('calculate_global_prestige', 'calculateGlobalPrestige', {});
    await run('compute_user_trust_score', 'computeUserTrustScore', {});

    // === EARNING VELOCITY & MILESTONES ===
    await run('earning_velocity_monitor', 'earningVelocityMonitor', {});
    await run('milestone_alert_checker', 'milestoneAlertChecker', {});

    // === TIER MANAGEMENT ===
    await run('daily_tier_check', 'dailyTierCheck', {});
    await run('update_user_tiers', 'updateUserTiers', {});

    // === ACHIEVEMENTS & BADGES ===
    await run('check_and_award_badges', 'checkAndAwardBadges', {});

    // === TOURNAMENT AUTO-MANAGEMENT ===
    // Find tournaments that need prize distribution
    const completedTournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'completed', prizes_distributed: false });
    const prizesDistributed = [];

    for (const t of completedTournaments.slice(0, 5)) {
      try {
        const res = await base44.asServiceRole.functions.invoke('distributeTournamentPrizes', { tournament_id: t.id });
        prizesDistributed.push({ tournament_id: t.id, result: res });
        console.log(`[TournamentGamification] ✓ Prizes distributed for tournament ${t.id}`);
      } catch (e) {
        console.error(`[TournamentGamification] ✗ Prize distribution failed for ${t.id}: ${e.message}`);
      }
    }

    // Find tournaments in 'registration' with enough participants → auto-start matchmaking
    const readyTournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'registration' });
    const matchmakingStarted = [];

    for (const t of readyTournaments.slice(0, 3)) {
      const participants = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: t.id });
      const regDeadlinePassed = t.registration_deadline && new Date(t.registration_deadline) < new Date();
      const hasEnoughParticipants = participants.length >= (t.min_participants || 4);

      if (hasEnoughParticipants && regDeadlinePassed) {
        try {
          await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'active' });
          matchmakingStarted.push(t.id);
          console.log(`[TournamentGamification] ✓ Auto-started tournament ${t.id}`);
        } catch (e) {
          console.error(`[TournamentGamification] ✗ Failed to start tournament ${t.id}: ${e.message}`);
        }
      }
    }

    // AI health assessment
    const assessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `GamerGain Tournament & Gamification Super Agent run summary:

Steps completed: ${Object.keys(results).join(', ')}
Steps failed: ${Object.keys(errors).join(', ') || 'none'}
Tournaments with prizes distributed: ${prizesDistributed.length}
Tournaments auto-started: ${matchmakingStarted.length}

Is platform gamification healthy? Any urgent action needed?
Return JSON: { "health": "healthy|warning|critical", "highlight": "1 sentence insight", "urgent_action": null or "string" }`,
      response_json_schema: {
        type: 'object',
        properties: {
          health: { type: 'string' },
          highlight: { type: 'string' },
          urgent_action: { type: 'string' }
        }
      }
    });

    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'tournament_gamification_superagent',
      action_type: 'full_pipeline_run',
      target_entity: 'Tournament',
      output_data: {
        results_keys: Object.keys(results), errors,
        prizes_distributed: prizesDistributed.length,
        tournaments_started: matchmakingStarted.length,
        ai_health: assessment.health
      },
      predicted_outcome: assessment.highlight,
      confidence_score: assessment.health === 'healthy' ? 90 : 60,
      tags: ['tournament', 'gamification', assessment.health]
    });

    return Response.json({
      success: true,
      agent: 'tournament_gamification_superagent',
      duration_ms: Date.now() - start,
      steps_ok: Object.keys(results).length,
      steps_failed: Object.keys(errors).length,
      prizes_distributed: prizesDistributed.length,
      tournaments_auto_started: matchmakingStarted.length,
      ai_assessment: assessment,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[TournamentGamification] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});