import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 7: Data Analysis & Insights Automation
// Handles: Market trend reports, user behavior analytics, predictive analytics, A/B test analysis
Deno.serve(async (req) => {
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

  // 1. Market Trend Reporting
  await invoke('generateMarketTrendReport');
  await invoke('aiMarketIntelligenceEngine');
  await invoke('aiCompetitiveIntelligenceEngine');
  results.market_reports_generated = true;

  // 2. User Behavior Analytics
  await invoke('uxAnalysisEngine');
  await invoke('aiUserExperienceOptimizer');
  await invoke('aiSurveyUXLearningEngine');
  results.ux_analytics_run = true;

  // 3. Predictive Analytics — churn, LTV, earnings forecast
  await invoke('churnPredictionEngine');
  await invoke('aiChurnPredictionEngine');
  await invoke('aiLTVPredictionEngine');
  await invoke('aiRevenueForecaster');
  results.predictive_analytics_run = true;

  // 4. A/B Test Analysis — evaluate results, pick winners
  await invoke('surveyABTestOptimizer');
  await invoke('aiFeedbackABOptimizer');
  await invoke('trackABTestMetrics', { batch: true });
  results.ab_tests_analyzed = true;

  // 5. Survey Intelligence Dashboard
  await invoke('runSurveyIntelligence');
  await invoke('surveyAnalyticsAI');
  await invoke('aiSurveyHeatmapAnalyzer');
  await invoke('aiSurveyInsightsDashboard');
  results.survey_analytics_run = true;

  // 6. Platform-wide AI Insights
  await invoke('aiPlatformInsights');
  await invoke('aiUniversalOptimizationEngine');
  results.platform_insights_generated = true;

  // 7. Earning Velocity Monitoring
  await invoke('earningVelocityMonitor');
  results.earning_velocity_checked = true;

  // 8. Agent Learning System — apply learnings from past performance
  await invoke('aiAgentLearningSystem');
  await invoke('applyApprovedLearnings');
  results.agent_learnings_applied = true;

  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_analytics_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});