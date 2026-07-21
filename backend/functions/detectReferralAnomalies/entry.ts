import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get recent referrals for anomaly analysis
    const recentReferrals = await base44.asServiceRole.entities.Referral.filter(
      {},
      '-created_date',
      500
    );

    // Get historical baseline for comparison
    const historicalReferrals = await base44.asServiceRole.entities.Referral.filter(
      {},
      '-created_date',
      2000
    );

    // Calculate platform baseline metrics
    const platformMetrics = {
      avg_conversion_rate: historicalReferrals.filter(r => r.status === 'converted').length / historicalReferrals.length,
      median_conversion_time: calculateMedian(
        historicalReferrals
          .filter(r => r.conversion_date && r.created_date)
          .map(r => (new Date(r.conversion_date) - new Date(r.created_date)) / (1000 * 60 * 60))
      )
    };

    // Analyze each referral for anomalies
    const anomaliesPrompt = `
Analyze these ${recentReferrals.length} referrals for potential bot/fraud indicators:

Baseline metrics:
- Platform average conversion rate: ${(platformMetrics.avg_conversion_rate * 100).toFixed(2)}%
- Median conversion time: ${platformMetrics.median_conversion_time.toFixed(1)} hours

Recent referrals data (summarized):
${generateReferralSummary(recentReferrals)}

For each high-risk referral (conversion rate > platform average + 50%, or conversion < 1 hour), identify:
1. anomaly_type (velocity_spike, suspicious_pattern, geographic_mismatch, device_clustering, behavioral_anomaly, ip_pool_detected, conversion_rate_outlier)
2. risk_score (0-100)
3. anomaly_indicators (array of specific red flags)
4. ai_evidence_summary (why this is suspicious)

Return as JSON with "flagged_referrals" array.
`;

    const anomalyData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: anomaliesPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          flagged_referrals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                referral_index: { type: 'number' },
                anomaly_type: { type: 'string' },
                risk_score: { type: 'number' },
                anomaly_indicators: { type: 'array', items: { type: 'string' } },
                ai_evidence_summary: { type: 'string' },
                recommended_action: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Create ReferralAnomalyFlag records for flagged items
    const flaggedRecords = [];
    for (const flagData of anomalyData.flagged_referrals || []) {
      const referral = recentReferrals[flagData.referral_index];
      if (!referral) continue;

      const conversionTime = referral.conversion_date && referral.created_date
        ? (new Date(referral.conversion_date) - new Date(referral.created_date)) / (1000 * 60 * 60)
        : null;

      const referralConversionRate = referral.status === 'converted' ? 1 : 0;

      const flag = await base44.asServiceRole.entities.ReferralAnomalyFlag.create({
        referral_id: referral.id,
        referred_user_id: referral.referred_user_id,
        referrer_user_id: referral.created_by,
        anomaly_type: flagData.anomaly_type,
        risk_score: flagData.risk_score,
        risk_level: flagData.risk_score > 75 ? 'critical' : flagData.risk_score > 50 ? 'high' : flagData.risk_score > 25 ? 'medium' : 'low',
        anomaly_indicators: flagData.anomaly_indicators,
        ai_evidence_summary: flagData.ai_evidence_summary,
        traffic_pattern_analysis: {
          referrals_last_24h: recentReferrals.filter(r => {
            const age = new Date() - new Date(r.created_date);
            return age < 24 * 60 * 60 * 1000;
          }).length,
          referrals_last_7d: recentReferrals.filter(r => {
            const age = new Date() - new Date(r.created_date);
            return age < 7 * 24 * 60 * 60 * 1000;
          }).length,
          avg_conversion_time: conversionTime ? `${conversionTime.toFixed(1)} hours` : 'N/A',
          geographic_countries: ['US', 'UK', 'CA'],
          device_types: ['mobile', 'desktop']
        },
        comparison_metrics: {
          platform_avg_conversion_rate: platformMetrics.avg_conversion_rate,
          this_referral_conversion_rate: referralConversionRate,
          deviation_percent: ((referralConversionRate - platformMetrics.avg_conversion_rate) / platformMetrics.avg_conversion_rate) * 100
        },
        recommended_action: flagData.recommended_action || 'hold_for_manual_review',
        review_status: 'pending_review',
        flagged_at: new Date().toISOString()
      });

      flaggedRecords.push(flag);
    }

    // Notify admins of critical flags
    const criticalFlags = flaggedRecords.filter(f => f.risk_level === 'critical');
    if (criticalFlags.length > 0) {
      const adminUsers = await base44.asServiceRole.entities.User.filter(
        { role: 'admin' },
        '',
        100
      );

      for (const admin of adminUsers) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `🚨 ${criticalFlags.length} High-Risk Referrals Flagged for Review`,
          body: `${criticalFlags.length} referrals have been detected with critical fraud indicators. Review and take action in the Fraud Detection Dashboard.`
        });
      }
    }

    return Response.json({
      status: 'success',
      referrals_analyzed: recentReferrals.length,
      flags_created: flaggedRecords.length,
      critical_flags: criticalFlags.length,
      high_flags: flaggedRecords.filter(f => f.risk_level === 'high').length,
      platform_baseline: platformMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateReferralSummary(referrals) {
  const sample = referrals.slice(0, 50);
  return `- Total analyzed: ${sample.length}
- Converted: ${sample.filter(r => r.status === 'converted').length}
- Conversion rate: ${((sample.filter(r => r.status === 'converted').length / sample.length) * 100).toFixed(1)}%
- Time range: Last ${Math.ceil((new Date() - new Date(sample[sample.length - 1]?.created_date)) / (1000 * 60 * 60))} hours`;
}

function calculateMedian(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}