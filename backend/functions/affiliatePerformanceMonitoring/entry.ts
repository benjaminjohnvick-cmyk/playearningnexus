import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all affiliates with recent performance data
    const affiliates = await base44.entities.Referral.filter({}, '-created_date', 1000);

    const performanceAlerts = [];
    const affiliateMetrics = {};

    // Group referrals by affiliate
    affiliates.forEach(ref => {
      if (!affiliateMetrics[ref.referrer_user_id]) {
        affiliateMetrics[ref.referrer_user_id] = {
          total: 0,
          conversions: 0,
          revenue: 0,
          last_7_days: 0,
          last_30_days: 0
        };
      }
      affiliateMetrics[ref.referrer_user_id].total++;
      if (ref.status === 'converted') {
        affiliateMetrics[ref.referrer_user_id].conversions++;
        affiliateMetrics[ref.referrer_user_id].revenue += ref.amount_earned || 0;
      }

      const daysSince = (Date.now() - new Date(ref.created_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 7) affiliateMetrics[ref.referrer_user_id].last_7_days++;
      if (daysSince <= 30) affiliateMetrics[ref.referrer_user_id].last_30_days++;
    });

    // Detect underperformers and generate alerts
    for (const [affiliateId, metrics] of Object.entries(affiliateMetrics)) {
      const conversionRate = metrics.total > 0 ? (metrics.conversions / metrics.total) * 100 : 0;

      // Alert: Low conversion rate
      if (metrics.total >= 10 && conversionRate < 1) {
        performanceAlerts.push({
          affiliate_id: affiliateId,
          alert_type: 'low_conversion_rate',
          severity: 'high',
          message: `Low conversion rate: ${conversionRate.toFixed(2)}% (${metrics.conversions}/${metrics.total})`,
          recommended_action: 'Send performance tips email'
        });
      }

      // Alert: No activity in 7 days
      if (metrics.last_7_days === 0 && metrics.total > 0) {
        performanceAlerts.push({
          affiliate_id: affiliateId,
          alert_type: 'no_recent_activity',
          severity: 'medium',
          message: 'No referrals in last 7 days',
          recommended_action: 'Trigger win-back campaign'
        });
      }

      // Alert: Performance trending down
      if (metrics.last_7_days < (metrics.last_30_days / 4) * 0.7 && metrics.last_30_days > 0) {
        performanceAlerts.push({
          affiliate_id: affiliateId,
          alert_type: 'performance_decline',
          severity: 'medium',
          message: `Performance declining: ${metrics.last_7_days} referrals (7d) vs avg ${(metrics.last_30_days / 4).toFixed(0)} (daily avg)`,
          recommended_action: 'Outreach with content suggestions'
        });
      }
    }

    // Create performance alert records
    for (const alert of performanceAlerts) {
      try {
        await base44.entities.PerformanceAlert.create(alert);
      } catch (e) {
        // Entity might not exist yet, skip
      }
    }

    return Response.json({
      success: true,
      alerts_generated: performanceAlerts.length,
      affiliates_analyzed: Object.keys(affiliateMetrics).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});