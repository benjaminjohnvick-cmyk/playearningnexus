import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Category 8: Developer & Game Management Automation
// Handles: Game approval/vetting, performance analytics, developer onboarding
export default __handler(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Game Approval & Vetting
  try {
    const pendingGames = await base44.asServiceRole.entities.Game.filter({ status: 'pending' });
    let gamesVetted = 0;
    for (const game of pendingGames.slice(0, 20)) {
      await invoke('autoGameMetricsAndApproval', { game_id: game.id });
      gamesVetted++;
    }
    results.games_vetted = gamesVetted;
  } catch (e) {
    errors.push({ fn: 'pending_games_fetch', error: e.message });
  }

  // 2. Game Performance Analytics for approved games
  try {
    const approvedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    let analyticsRun = 0;
    for (const game of approvedGames.slice(0, 20)) {
      await invoke('gameSentimentReport', { game_id: game.id });
      analyticsRun++;
    }
    results.game_analytics_run = analyticsRun;
  } catch (e) {
    errors.push({ fn: 'approved_games_fetch', error: e.message });
  }

  // 3. Developer Onboarding Personalization
  try {
    const pendingClients = await base44.asServiceRole.entities.BusinessClient.filter({ onboarding_completed: false });
    let onboardingRun = 0;
    for (const client of pendingClients.slice(0, 10)) {
      await invoke('aiOnboardingPersonalizer', { client_id: client.id });
      onboardingRun++;
    }
    results.developer_onboarding_run = onboardingRun;
  } catch (e) {
    errors.push({ fn: 'pending_clients_fetch', error: e.message });
  }

  // 4. Pre-Launch Survey Generation for new games
  try {
    const newGames = await base44.asServiceRole.entities.Game.filter({ status: 'pending' });
    let preLaunchSurveys = 0;
    for (const game of newGames.slice(0, 5)) {
      if (!game.concept_survey_id) {
        await invoke('aiDevPreLaunchSurvey', { game_id: game.id });
        preLaunchSurveys++;
      }
    }
    results.pre_launch_surveys_created = preLaunchSurveys;
  } catch (e) {
    errors.push({ fn: 'pre_launch_surveys', error: e.message });
  }

  // 5. Developer Feedback Surveys
  await invoke('aiDeveloperFeedbackSurvey');
  results.developer_feedback_surveys_sent = true;

  // 6. App Store Earnings Validation
  await invoke('appStoreEarningsValidator');
  results.earnings_validated = true;

  // 7. Game Voting Pipeline
  await invoke('gameVotingPipeline');
  results.game_votes_processed = true;

  // 8. Developer Payout Calculation & Optimization
  await invoke('calculateDeveloperPayout', { batch: true });
  await invoke('autoCreatorPayoutOptimization');
  results.developer_payouts_run = true;

  // 9. Install CPI Tracking
  await invoke('chargeInstallCPI', { batch: true });
  results.install_cpi_charged = true;

  // 10. Audit log (only valid fields — no timestamp field)
  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_developer_management_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});