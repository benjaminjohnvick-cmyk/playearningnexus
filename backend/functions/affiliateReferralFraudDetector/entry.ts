import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const affiliateId = body.affiliate_user_id;

    // Fetch referrals for this affiliate (or all if no ID given)
    const query = affiliateId ? { referrer_user_id: affiliateId } : {};
    const referrals = await base44.asServiceRole.entities.Referral.list('-created_date', 500);
    const filtered = affiliateId ? referrals.filter(r => r.referrer_user_id === affiliateId) : referrals;

    // Group by referrer
    const byReferrer = {};
    for (const r of filtered) {
      const id = r.referrer_user_id;
      if (!id) continue;
      if (!byReferrer[id]) byReferrer[id] = [];
      byReferrer[id].push(r);
    }

    const results = [];

    for (const [refId, refs] of Object.entries(byReferrer)) {
      const indicators = [];
      let riskScore = 0;

      const now = Date.now();
      const last24h = refs.filter(r => now - new Date(r.created_date).getTime() < 86400000);
      const last7d = refs.filter(r => now - new Date(r.created_date).getTime() < 604800000);

      // Velocity spike: >10 referrals in 24h
      if (last24h.length > 10) {
        riskScore += 30;
        indicators.push(`High velocity: ${last24h.length} referrals in 24h`);
      } else if (last24h.length > 5) {
        riskScore += 15;
        indicators.push(`Elevated velocity: ${last24h.length} referrals in 24h`);
      }

      // Conversion rate outlier: >80% conversion is suspicious
      const converted = refs.filter(r => r.status === 'converted');
      const convRate = refs.length > 0 ? converted.length / refs.length : 0;
      if (convRate > 0.8 && refs.length > 5) {
        riskScore += 25;
        indicators.push(`Suspicious conversion rate: ${(convRate * 100).toFixed(0)}%`);
      }

      // All referrals in very short time window (< 1 min apart on average)
      if (refs.length > 3) {
        const times = refs.map(r => new Date(r.created_date).getTime()).sort();
        const gaps = [];
        for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (avgGap < 60000) {
          riskScore += 25;
          indicators.push(`Rapid fire pattern: avg ${Math.round(avgGap / 1000)}s between referrals`);
        }
      }

      // Very low reward amounts (possible bot fill)
      const avgReward = refs.reduce((s, r) => s + (r.reward_amount || 0), 0) / refs.length;
      if (avgReward < 0.10 && refs.length > 5) {
        riskScore += 10;
        indicators.push('Unusually low reward amounts detected');
      }

      riskScore = Math.min(riskScore, 100);
      const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

      // Use AI for summary
      let aiSummary = `Affiliate has ${refs.length} total referrals, ${converted.length} conversions (${(convRate * 100).toFixed(0)}% rate).`;
      if (indicators.length > 0) {
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a fraud analyst. Summarize the following referral fraud indicators for an affiliate in 2 sentences and recommend an action (approve/hold/suspend): ${indicators.join('; ')}. Referral count: ${refs.length}, conversion rate: ${(convRate * 100).toFixed(0)}%, risk score: ${riskScore}/100.`,
        });
        aiSummary = aiResult || aiSummary;
      }

      // Save anomaly flag if high risk
      if (riskScore >= 50 && refs.length > 0) {
        const existing = await base44.asServiceRole.entities.ReferralAnomalyFlag.filter({
          referrer_user_id: refId,
          review_status: 'pending_review',
        });

        if (existing.length === 0) {
          await base44.asServiceRole.entities.ReferralAnomalyFlag.create({
            referral_id: refs[0].id,
            referrer_user_id: refId,
            anomaly_type: last24h.length > 10 ? 'velocity_spike' : 'behavioral_anomaly',
            risk_score: riskScore,
            risk_level: riskLevel,
            anomaly_indicators: indicators,
            ai_evidence_summary: aiSummary,
            traffic_pattern_analysis: {
              referrals_last_24h: last24h.length,
              referrals_last_7d: last7d.length,
            },
            comparison_metrics: {
              platform_avg_conversion_rate: 0.35,
              this_referral_conversion_rate: convRate,
              deviation_percent: ((convRate - 0.35) / 0.35) * 100,
            },
            recommended_action: riskScore >= 70 ? 'suspend_referrer' : riskScore >= 50 ? 'hold_for_manual_review' : 'investigate_further',
            review_status: 'pending_review',
            flagged_at: new Date().toISOString(),
          });

          // Auto-pause suspicious payouts
          const pendingPayouts = await base44.asServiceRole.entities.PayoutRequest.filter({
            affiliate_user_id: refId,
            status: 'pending_validation',
          });
          for (const p of pendingPayouts) {
            await base44.asServiceRole.entities.PayoutRequest.update(p.id, {
              status: 'failed',
              processing_notes: `Auto-paused: fraud risk score ${riskScore}/100. Indicators: ${indicators.join('; ')}`,
            });
          }
        }
      }

      results.push({
        affiliate_user_id: refId,
        risk_score: riskScore,
        risk_level: riskLevel,
        indicators,
        ai_summary: aiSummary,
        referral_count: refs.length,
        conversion_rate: convRate,
      });
    }

    results.sort((a, b) => b.risk_score - a.risk_score);
    return Response.json({ success: true, analyzed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});