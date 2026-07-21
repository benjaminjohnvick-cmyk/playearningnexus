import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch comprehensive platform metrics
    const [referrals, affiliates, competitors] = await Promise.all([
      base44.entities.Referral.filter({}, '-created_date', 500),
      base44.entities.AffiliateOnboarding.filter({}, '-created_at', 200),
      base44.entities.CompetitorTrendAnalysis.filter({}, '-analyzed_at', 10)
    ]);

    const metrics = {
      total_referrals: referrals.length,
      conversion_rate: (referrals.filter(r => r.status === 'converted').length / Math.max(referrals.length, 1)) * 100,
      avg_payout: referrals.reduce((sum, r) => sum + (r.amount_earned || 0), 0) / Math.max(referrals.length, 1),
      active_affiliates: affiliates.filter(a => a.onboarding_status === 'completed').length,
      competitor_count: competitors.length
    };

    // Use AI to generate strategic recommendations
    const strategyPrompt = `As a business strategist, analyze these metrics and recommend 3 high-impact growth strategies:
- Total referrals: ${metrics.total_referrals}
- Conversion rate: ${metrics.conversion_rate.toFixed(2)}%
- Avg payout per referral: $${metrics.avg_payout.toFixed(2)}
- Active affiliates: ${metrics.active_affiliates}
- Competitors to monitor: ${metrics.competitor_count}

Provide: 1) Target goal (e.g., increase affiliates by X%), 2) Resource allocation, 3) Timeline and expected ROI.`;

    const strategies = await base44.integrations.Core.InvokeLLM({
      prompt: strategyPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          strategies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                target_goal: { type: 'string' },
                resource_allocation: { type: 'string' },
                expected_roi: { type: 'string' },
                timeline_weeks: { type: 'number' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      current_metrics: metrics,
      strategic_recommendations: strategies.strategies
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});