import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 7: Data Analysis & Insights Automation
// Handles: Market trend reports, user behavior analytics, predictive analytics, A/B test analysis
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Market Trend Reporting
    await base44.asServiceRole.functions.invoke('generateMarketTrendReport', {});
    await base44.asServiceRole.functions.invoke('aiMarketIntelligenceEngine', {});
    await base44.asServiceRole.functions.invoke('aiCompetitiveIntelligenceEngine', {});
    results.market_reports_generated = true;

    // 2. User Behavior Analytics
    await base44.asServiceRole.functions.invoke('uxAnalysisEngine', {});
    await base44.asServiceRole.functions.invoke('aiUserExperienceOptimizer', {});
    await base44.asServiceRole.functions.invoke('aiSurveyUXLearningEngine', {});
    results.ux_analytics_run = true;

    // 3. Predictive Analytics — churn, LTV, earnings forecast
    await base44.asServiceRole.functions.invoke('churnPredictionEngine', {});
    await base44.asServiceRole.functions.invoke('aiChurnPredictionEngine', {});
    await base44.asServiceRole.functions.invoke('aiLTVPredictionEngine', {});
    await base44.asServiceRole.functions.invoke('aiRevenueForecaster', {});
    results.predictive_analytics_run = true;

    // 4. A/B Test Analysis — evaluate results, pick winners
    await base44.asServiceRole.functions.invoke('surveyABTestOptimizer', {});
    await base44.asServiceRole.functions.invoke('aiFeedbackABOptimizer', {});
    await base44.asServiceRole.functions.invoke('trackABTestMetrics', { batch: true });
    results.ab_tests_analyzed = true;

    // 5. Survey Intelligence Dashboard
    await base44.asServiceRole.functions.invoke('runSurveyIntelligence', {});
    await base44.asServiceRole.functions.invoke('surveyAnalyticsAI', {});
    await base44.asServiceRole.functions.invoke('aiSurveyHeatmapAnalyzer', {});
    await base44.asServiceRole.functions.invoke('aiSurveyInsightsDashboard', {});
    results.survey_analytics_run = true;

    // 6. Platform-wide AI Insights
    await base44.asServiceRole.functions.invoke('aiPlatformInsights', {});
    await base44.asServiceRole.functions.invoke('aiUniversalOptimizationEngine', {});
    results.platform_insights_generated = true;

    // 7. Earning Velocity Monitoring
    await base44.asServiceRole.functions.invoke('earningVelocityMonitor', {});
    results.earning_velocity_checked = true;

    // 8. Agent Learning System — apply learnings from past performance
    await base44.asServiceRole.functions.invoke('aiAgentLearningSystem', {});
    await base44.asServiceRole.functions.invoke('applyApprovedLearnings', {});
    results.agent_learnings_applied = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_analytics_engine_run: ${JSON.stringify(results)}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});