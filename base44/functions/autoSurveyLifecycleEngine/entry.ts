import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: survey creation, scheduling, distribution, quality scanning, scoring, health monitoring
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Daily AI survey generation
    await base44.asServiceRole.functions.invoke('dailyAISurveyGenerator', {});
    results.daily_surveys_generated = true;

    // 2. Process survey schedules
    await base44.asServiceRole.functions.invoke('processSurveySchedules', {});
    results.survey_schedules_processed = true;

    // 3. Auto-distribute surveys to matched users
    await base44.asServiceRole.functions.invoke('aiSurveyAutoDistribute', {});
    await base44.asServiceRole.functions.invoke('scheduleSurveyDistribution', {});
    results.surveys_distributed = true;

    // 4. Survey quality monitoring and auto-scan
    await base44.asServiceRole.functions.invoke('surveyQualityMonitor', {});
    await base44.asServiceRole.functions.invoke('surveyQualityAutoScan', {});
    await base44.asServiceRole.functions.invoke('surveyHealthMonitor', {});
    results.survey_quality_checked = true;

    // 5. Score survey responses
    await base44.asServiceRole.functions.invoke('scoreSurveyResponse', { batch: true });
    results.responses_scored = true;

    // 6. Classify response themes for feedback analysis
    await base44.asServiceRole.functions.invoke('classifyResponseThemes', {});
    results.themes_classified = true;

    // 7. Audit survey responses for anomalies
    await base44.asServiceRole.functions.invoke('auditSurveyResponses', {});
    results.responses_audited = true;

    // 8. Survey A/B test optimization
    await base44.asServiceRole.functions.invoke('surveyABTestOptimizer', {});
    results.ab_tests_optimized = true;

    // 9. Launch optimization for new surveys
    await base44.asServiceRole.functions.invoke('aiSurveyLaunchOptimizer', {});
    results.launches_optimized = true;

    // 10. Respondent micro-payouts for completed surveys
    await base44.asServiceRole.functions.invoke('respondentMicroPayout', {});
    results.micro_payouts_processed = true;

    // 11. High-quality response notifications
    await base44.asServiceRole.functions.invoke('notifyHighQualityResponse', {});
    results.quality_notifications_sent = true;

    // 12. Marketplace listing auto-generation for active surveys
    const activeSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 20);
    let marketplaceListings = 0;
    for (const survey of activeSurveys) {
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
    }
    results.marketplace_listings_created = marketplaceListings;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});