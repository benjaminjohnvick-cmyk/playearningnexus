import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 8: Developer & Game Management Automation
// Handles: Game approval/vetting, performance analytics, developer onboarding
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Game Approval & Vetting
    const pendingGames = await base44.asServiceRole.entities.Game.filter({ status: 'pending' });
    let gamesVetted = 0;
    for (const game of pendingGames.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('autoGameMetricsAndApproval', { game_id: game.id });
      gamesVetted++;
    }
    results.games_vetted = gamesVetted;

    // 2. Game Performance Analytics for approved games
    const approvedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    let analyticsRun = 0;
    for (const game of approvedGames.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('gameSentimentReport', { game_id: game.id });
      analyticsRun++;
    }
    results.game_analytics_run = analyticsRun;

    // 3. Developer Onboarding Personalization
    const pendingClients = await base44.asServiceRole.entities.BusinessClient.filter({ onboarding_completed: false });
    let onboardingRun = 0;
    for (const client of pendingClients.slice(0, 10)) {
      await base44.asServiceRole.functions.invoke('aiOnboardingPersonalizer', { client_id: client.id });
      onboardingRun++;
    }
    results.developer_onboarding_run = onboardingRun;

    // 4. Pre-Launch Survey Generation for new games
    const newGames = await base44.asServiceRole.entities.Game.filter({ status: 'pending' });
    let preLaunchSurveys = 0;
    for (const game of newGames.slice(0, 5)) {
      if (!game.concept_survey_id) {
        await base44.asServiceRole.functions.invoke('aiDevPreLaunchSurvey', { game_id: game.id });
        preLaunchSurveys++;
      }
    }
    results.pre_launch_surveys_created = preLaunchSurveys;

    // 5. Developer Feedback Surveys
    await base44.asServiceRole.functions.invoke('aiDeveloperFeedbackSurvey', {});
    results.developer_feedback_surveys_sent = true;

    // 6. App Store Earnings Validation
    await base44.asServiceRole.functions.invoke('appStoreEarningsValidator', {});
    results.earnings_validated = true;

    // 7. Game Voting Pipeline — tally votes and move winners to featured queue
    await base44.asServiceRole.functions.invoke('gameVotingPipeline', {});
    results.game_votes_processed = true;

    // 8. Developer Payout Calculation & Optimization
    await base44.asServiceRole.functions.invoke('calculateDeveloperPayout', { batch: true });
    await base44.asServiceRole.functions.invoke('autoCreatorPayoutOptimization', {});
    results.developer_payouts_run = true;

    // 9. Install CPI Tracking
    await base44.asServiceRole.functions.invoke('chargeInstallCPI', { batch: true });
    results.install_cpi_charged = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_developer_management_engine_run: ${JSON.stringify(results)}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});