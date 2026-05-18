import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: weekly contest winners, weekly ad reports, weekly top earners, revenue forecasting,
// LTV prediction, competitive intelligence, retention optimization, AI platform insights
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Process weekly contest winners
    await base44.asServiceRole.functions.invoke('weeklyContestWinner', {});
    results.weekly_contest_winners_processed = true;

    // 2. Send weekly ad performance reports to advertisers
    await base44.asServiceRole.functions.invoke('sendWeeklyAdReport', {});
    results.weekly_ad_reports_sent = true;

    // 3. Notify weekly top earners
    await base44.asServiceRole.functions.invoke('notifyWeeklyTopEarners', {});
    results.weekly_top_earners_notified = true;

    // 4. Referral contest leaderboard update
    await base44.asServiceRole.functions.invoke('referralContestLeaderboard', {});
    results.referral_leaderboard_updated = true;

    // 5. AI revenue forecasting
    await base44.asServiceRole.functions.invoke('aiRevenueForecaster', {});
    results.revenue_forecast_generated = true;

    // 6. LTV prediction for all active users
    await base44.asServiceRole.functions.invoke('aiLTVPredictionEngine', {});
    results.ltv_predictions_updated = true;

    // 7. Competitive intelligence scan
    await base44.asServiceRole.functions.invoke('aiCompetitiveIntelligenceEngine', {});
    results.competitive_intel_scanned = true;

    // 8. Retention optimizer run
    await base44.asServiceRole.functions.invoke('aiRetentionOptimizer', {});
    results.retention_optimized = true;

    // 9. AI platform insights
    await base44.asServiceRole.functions.invoke('aiPlatformInsights', {});
    results.platform_insights_generated = true;

    // 10. Market intelligence report
    await base44.asServiceRole.functions.invoke('aiMarketIntelligenceEngine', {});
    results.market_intelligence_updated = true;

    // 11. Generate market trend report
    await base44.asServiceRole.functions.invoke('generateMarketTrendReport', {});
    results.market_trend_report_generated = true;

    // 12. Ad campaign health digest
    await base44.asServiceRole.functions.invoke('adCampaignHealthDigest', {});
    results.ad_campaign_health_digest_sent = true;

    // 13. Survey analytics AI weekly batch
    await base44.asServiceRole.functions.invoke('surveyAnalyticsAI', { mode: 'weekly' });
    results.survey_analytics_weekly_run = true;

    // 14. Email marketing automation weekly batch
    await base44.asServiceRole.functions.invoke('emailMarketingAutomation', { mode: 'weekly' });
    results.weekly_email_campaigns_sent = true;

    // 15. Referral re-engagement email for inactive referrers
    await base44.asServiceRole.functions.invoke('referralReengagementEmail', {});
    results.referral_reengagement_sent = true;

    // 16. Partner notification webhook
    await base44.asServiceRole.functions.invoke('partnerNotificationWebhook', { type: 'weekly_report' });
    results.partner_notifications_sent = true;

    // 17. Admin alert notifier — weekly summary
    await base44.asServiceRole.functions.invoke('adminAlertNotifier', { type: 'weekly_summary' });
    results.admin_weekly_summary_sent = true;

    // 18. AI user retention weekly batch
    await base44.asServiceRole.functions.invoke('aiUserRetention', { mode: 'weekly' });
    results.user_retention_weekly_run = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});