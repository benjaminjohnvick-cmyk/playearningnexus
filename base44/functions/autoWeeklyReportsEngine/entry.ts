import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: weekly contest winners, weekly ad reports, weekly top earners, revenue forecasting,
// LTV prediction, competitive intelligence, retention optimization, AI platform insights
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = {};

  const run = async (key, fn, payload = {}) => {
    try {
      results[key] = await base44.asServiceRole.functions.invoke(fn, payload);
    } catch (e) {
      errors[key] = e.message;
      console.warn(`[WeeklyReports] ${key} failed: ${e.message}`);
    }
  };

  try {
    // 1. Contest & leaderboard
    await run('weekly_contest_winners', 'weeklyContestWinner', {});
    await run('referral_leaderboard', 'referralContestLeaderboard', {});
    await run('notify_top_earners', 'notifyWeeklyTopEarners', {});

    // 2. Ad reporting
    await run('weekly_ad_report', 'sendWeeklyAdReport', {});
    await run('ad_campaign_health', 'adCampaignHealthDigest', {});

    // 3. AI insights
    await run('revenue_forecast', 'aiRevenueForecaster', {});
    await run('ltv_predictions', 'aiLTVPredictionEngine', {});
    await run('competitive_intel', 'aiCompetitiveIntelligenceEngine', {});
    await run('retention_optimized', 'aiRetentionOptimizer', {});
    await run('platform_insights', 'aiPlatformInsights', {});
    await run('market_intelligence', 'aiMarketIntelligenceEngine', {});
    await run('market_trend_report', 'generateMarketTrendReport', {});

    // 4. Communication
    await run('survey_analytics', 'surveyAnalyticsAI', { mode: 'weekly' });
    await run('email_campaigns', 'emailMarketingAutomation', { mode: 'weekly' });
    await run('referral_reengagement', 'referralReengagementEmail', {});
    await run('partner_notifications', 'partnerNotificationWebhook', { type: 'weekly_report' });
    await run('admin_weekly_summary', 'adminAlertNotifier', { type: 'weekly_summary' });
    await run('user_retention', 'aiUserRetention', { mode: 'weekly' });

    return Response.json({ success: true, results, errors: Object.keys(errors).length > 0 ? errors : undefined });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});