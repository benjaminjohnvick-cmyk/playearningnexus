import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch onboarding records
    const onboardings = await base44.entities.AffiliateOnboarding.filter({}, '-created_at', 500);

    const churnRisks = [];

    for (const onboarding of onboardings) {
      // Fetch recent affiliate activity
      const recentReferrals = await base44.entities.Referral.filter(
        { referrer_user_id: onboarding.affiliate_user_id },
        '-created_date',
        50
      );

      const daysSinceOnboarding = (Date.now() - new Date(onboarding.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceLastActivity = recentReferrals.length > 0
        ? (Date.now() - new Date(recentReferrals[0].created_date).getTime()) / (1000 * 60 * 60 * 24)
        : daysSinceOnboarding;

      const conversions = recentReferrals.filter(r => r.status === 'converted').length;
      const conversionRate = recentReferrals.length > 0 ? (conversions / recentReferrals.length) * 100 : 0;

      let churnScore = 0;
      let indicators = [];

      // Scoring factors
      if (daysSinceLastActivity > 14) {
        churnScore += 35;
        indicators.push('inactive_14_days');
      }
      if (daysSinceLastActivity > 7) {
        churnScore += 25;
        indicators.push('inactive_7_days');
      }
      if (conversionRate < 1 && recentReferrals.length >= 10) {
        churnScore += 20;
        indicators.push('low_conversion_rate');
      }
      if (recentReferrals.length === 0 && daysSinceOnboarding > 14) {
        churnScore += 40;
        indicators.push('zero_activity_post_onboarding');
      }
      if (onboarding.onboarding_status !== 'completed') {
        churnScore += 15;
        indicators.push('incomplete_onboarding');
      }

      if (churnScore >= 30) {
        churnRisks.push({
          affiliate_id: onboarding.affiliate_user_id,
          churn_score: Math.min(churnScore, 100),
          risk_level: churnScore >= 70 ? 'critical' : churnScore >= 50 ? 'high' : 'medium',
          last_activity_days: daysSinceLastActivity,
          conversion_rate: conversionRate,
          indicators,
          recommended_action: churnScore >= 70 ? 'immediate_outreach' : 'win_back_campaign'
        });
      }
    }

    // Sort by risk score
    churnRisks.sort((a, b) => b.churn_score - a.churn_score);

    return Response.json({
      success: true,
      at_risk_count: churnRisks.length,
      critical_count: churnRisks.filter(r => r.risk_level === 'critical').length,
      risks: churnRisks.slice(0, 100)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});