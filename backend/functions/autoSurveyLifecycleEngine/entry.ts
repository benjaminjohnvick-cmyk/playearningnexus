import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: survey creation, scheduling, distribution, quality scanning, scoring, health monitoring
export default __handler(async (req) => {
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

  // 1. Daily AI survey generation
  await invoke('dailyAISurveyGenerator');
  results.daily_surveys_generated = true;

  // 2. Process survey schedules
  await invoke('processSurveySchedules');
  results.survey_schedules_processed = true;

  // 3. Auto-distribute surveys to matched users
  await invoke('aiSurveyAutoDistribute');
  await invoke('scheduleSurveyDistribution');
  results.surveys_distributed = true;

  // 4. Survey quality monitoring and auto-scan
  await invoke('surveyQualityMonitor');
  await invoke('surveyQualityAutoScan');
  await invoke('surveyHealthMonitor');
  results.survey_quality_checked = true;

  // 5. Score survey responses
  await invoke('scoreSurveyResponse', { batch: true });
  results.responses_scored = true;

  // 6. Classify response themes for feedback analysis
  await invoke('classifyResponseThemes');
  results.themes_classified = true;

  // 7. Audit survey responses for anomalies
  await invoke('auditSurveyResponses');
  results.responses_audited = true;

  // 8. Survey A/B test optimization
  await invoke('surveyABTestOptimizer');
  results.ab_tests_optimized = true;

  // 9. Launch optimization for new surveys
  await invoke('aiSurveyLaunchOptimizer');
  results.launches_optimized = true;

  // 10. Respondent micro-payouts for completed surveys
  await invoke('respondentMicroPayout');
  results.micro_payouts_processed = true;

  // 11. High-quality response notifications
  await invoke('notifyHighQualityResponse');
  results.quality_notifications_sent = true;

  // 12. Marketplace listing auto-generation for active surveys
  try {
    const activeSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 20);
    let marketplaceListings = 0;
    for (const survey of activeSurveys) {
      try {
        const existing = await base44.asServiceRole.entities.SurveyMarketplaceListing.filter({ survey_id: survey.id });
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.entities.SurveyMarketplaceListing.create({
            survey_id: survey.id,
            title: survey.title,
            status: 'active',
            listed_at: new Date().toISOString()
          });
          marketplaceListings++;
        }
      } catch (e) {
        errors.push({ fn: 'marketplace_listing_create', id: survey.id, error: e.message });
      }
    }
    results.marketplace_listings_created = marketplaceListings;
  } catch (e) {
    errors.push({ fn: 'active_surveys_fetch', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});