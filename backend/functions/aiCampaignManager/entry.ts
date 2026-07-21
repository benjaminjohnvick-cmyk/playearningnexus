import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  // Scheduled automation path: no body, no user session — bulk optimize all active campaigns
  const contentType = req.headers.get('content-type') || '';
  const hasBody = contentType.includes('application/json');
  if (!hasBody) {
    const activeCampaigns = await base44.asServiceRole.entities.AdCampaign.filter({ status: 'active' });
    let optimized = 0;
    for (const campaign of activeCampaigns) {
      if (!campaign.ai_bid_enabled) continue;
      const perf = campaign.performance || {};
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `AI bidding optimizer for GamerGain ad campaign "${campaign.name}".
        Current bid: $${campaign.bid_amount || 0}, Impressions: ${perf.impressions || 0}, Clicks: ${perf.clicks || 0}, Conversions: ${perf.conversions || 0}, CTR: ${(perf.ctr || 0).toFixed(3)}%, ROAS: ${perf.roas || 0}x.
        Return a recommended_bid (number) and optimization_tips (array of 3 strings).`,
        response_json_schema: {
          type: "object",
          properties: {
            recommended_bid: { type: "number" },
            optimization_tips: { type: "array", items: { type: "string" } }
          }
        }
      });
      if (result.recommended_bid) {
        await base44.asServiceRole.entities.AdCampaign.update(campaign.id, {
          bid_amount: result.recommended_bid,
          last_optimized_at: new Date().toISOString(),
          ai_suggestions: {
            recommended_bid: result.recommended_bid,
            optimization_tips: result.optimization_tips || [],
            generated_at: new Date().toISOString()
          }
        });
        optimized++;
      }
    }
    return Response.json({ ok: true, optimized_campaigns: optimized });
  }

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id, demographics, objective, budget, campaign_data } = body;

  if (action === 'generate_campaign') {
    // AI-assisted campaign creation based on target demographics
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert digital advertising strategist for GamerGain, a gaming/survey rewards platform.
      
      Generate a complete, optimized ad campaign based on:
      - Objective: ${objective}
      - Budget: $${budget} total
      - Target Demographics: ${JSON.stringify(demographics)}
      
      Return a complete campaign strategy with:
      1. Campaign name and compelling ad copy (headline 60 chars max, description 150 chars max, CTA)
      2. Recommended bid strategy and bid amount
      3. Audience refinement suggestions based on the demographics
      4. Predicted CTR (0.01-0.15), estimated conversions, audience score (0-100)
      5. 3 specific optimization tips for this campaign
      6. Recommended daily budget allocation
      7. Best platforms to target (from: facebook, instagram, twitter, tiktok, snapchat, in_app)
      8. Interest targeting keywords relevant to gaming/survey audience
      
      Be specific and data-driven. Tailor everything to the GamerGain gaming audience.`,
      response_json_schema: {
        type: "object",
        properties: {
          campaign_name: { type: "string" },
          headline: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
          bid_strategy: { type: "string" },
          recommended_bid: { type: "number" },
          daily_budget: { type: "number" },
          predicted_ctr: { type: "number" },
          predicted_conversions: { type: "number" },
          audience_score: { type: "number" },
          optimization_tips: { type: "array", items: { type: "string" } },
          recommended_platforms: { type: "array", items: { type: "string" } },
          interest_keywords: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" }
        }
      }
    });
    return Response.json({ success: true, campaign: result });
  }

  if (action === 'optimize_bid') {
    // Automated bidding assistant
    const campaign = await base44.entities.AdCampaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const perf = campaign.performance || {};
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI bidding optimizer for digital ad campaigns on GamerGain platform.

      Campaign Performance Data:
      - Current Bid: $${campaign.bid_amount || 0}
      - Budget Remaining: $${(campaign.budget_total || 0) - (campaign.budget_spent || 0)}
      - Daily Budget: $${campaign.budget_daily || 0}
      - Impressions: ${perf.impressions || 0}
      - Clicks: ${perf.clicks || 0}
      - Conversions: ${perf.conversions || 0}
      - CTR: ${(perf.ctr || 0).toFixed(3)}%
      - CPC: $${perf.cpc || 0}
      - CPA: $${perf.cpa || 0}
      - ROAS: ${perf.roas || 0}x
      - Revenue Generated: $${perf.revenue_generated || 0}
      - Avg LTV of converted users: $${perf.avg_ltv || 0}
      - Churn Rate of acquired users: ${perf.churn_rate || 0}%
      - Bid Strategy: ${campaign.bid_strategy}
      - Target CPA: $${campaign.target_cpa || 'not set'}
      - Target ROAS: ${campaign.target_roas || 'not set'}x

      Analyze this data and provide:
      1. Recommended new bid amount (be precise to 2 decimal places)
      2. Bid adjustment percentage (-50% to +100%)
      3. Confidence score (0-100) in this recommendation
      4. Specific reasoning for the change
      5. Projected impact: new CTR, conversions, ROAS
      6. Budget pacing recommendation (spend faster/slower)
      7. 3 actionable steps to improve ROI immediately`,
      response_json_schema: {
        type: "object",
        properties: {
          recommended_bid: { type: "number" },
          bid_adjustment_pct: { type: "number" },
          confidence_score: { type: "number" },
          reasoning: { type: "string" },
          projected_ctr: { type: "number" },
          projected_conversions: { type: "number" },
          projected_roas: { type: "number" },
          budget_pacing: { type: "string" },
          action_steps: { type: "array", items: { type: "string" } },
          alert_level: { type: "string" }
        }
      }
    });

    // Auto-apply if AI bidding enabled
    if (campaign.ai_bid_enabled && result.recommended_bid) {
      await base44.entities.AdCampaign.update(campaign_id, {
        bid_amount: result.recommended_bid,
        last_optimized_at: new Date().toISOString(),
        ai_suggestions: {
          ...(campaign.ai_suggestions || {}),
          recommended_bid: result.recommended_bid,
          optimization_tips: result.action_steps,
          generated_at: new Date().toISOString()
        }
      });
    }

    return Response.json({ success: true, optimization: result });
  }

  if (action === 'get_ltv_churn_insights') {
    // LTV and churn analysis for campaign audience
    const campaign = await base44.entities.AdCampaign.get(campaign_id);
    const recentUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze LTV and churn insights for an ad campaign on GamerGain gaming platform.

      Campaign: ${campaign?.name}
      Objective: ${campaign?.objective}
      Target Demographics: ${JSON.stringify(campaign?.demographics)}
      Performance: ${JSON.stringify(campaign?.performance)}
      Daily Stats (last 7 days): ${JSON.stringify((campaign?.daily_stats || []).slice(-7))}

      Platform has ${recentUsers.length} recent users.

      Provide comprehensive LTV and churn analysis:
      1. Estimated LTV for users acquired through this campaign ($)
      2. Predicted 30/60/90-day churn rates (%)
      3. LTV:CAC ratio assessment
      4. Cohort behavior predictions
      5. High-value user segments to double down on
      6. Churn risk signals to watch for
      7. Recommended re-engagement strategies
      8. Revenue forecast for next 30 days from this campaign`,
      response_json_schema: {
        type: "object",
        properties: {
          estimated_ltv: { type: "number" },
          churn_30d: { type: "number" },
          churn_60d: { type: "number" },
          churn_90d: { type: "number" },
          ltv_cac_ratio: { type: "number" },
          ltv_rating: { type: "string" },
          high_value_segments: { type: "array", items: { type: "string" } },
          churn_risk_signals: { type: "array", items: { type: "string" } },
          reengagement_strategies: { type: "array", items: { type: "string" } },
          revenue_forecast_30d: { type: "number" },
          cohort_insights: { type: "string" },
          overall_health_score: { type: "number" }
        }
      }
    });

    return Response.json({ success: true, insights: result });
  }

  if (action === 'simulate_performance') {
    // Simulate realistic daily performance data for a campaign
    const campaign = await base44.entities.AdCampaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const days = campaign.daily_stats?.length || 0;
    const dailyBudget = campaign.budget_daily || 50;
    const newStats = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const variance = 0.8 + Math.random() * 0.4;
      const spend = Math.min(dailyBudget * variance, dailyBudget);
      const impressions = Math.floor(spend * (80 + Math.random() * 40));
      const clicks = Math.floor(impressions * (0.02 + Math.random() * 0.03));
      const conversions = Math.floor(clicks * (0.05 + Math.random() * 0.1));
      const revenue = conversions * (15 + Math.random() * 25);
      newStats.push({
        date: date.toISOString().split('T')[0],
        impressions,
        clicks,
        conversions,
        spend: parseFloat(spend.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        ctr: parseFloat((clicks / impressions * 100).toFixed(3)),
        roas: parseFloat((revenue / spend).toFixed(2))
      });
    }

    const totalImpressions = newStats.reduce((s, d) => s + d.impressions, 0);
    const totalClicks = newStats.reduce((s, d) => s + d.clicks, 0);
    const totalConversions = newStats.reduce((s, d) => s + d.conversions, 0);
    const totalSpend = newStats.reduce((s, d) => s + d.spend, 0);
    const totalRevenue = newStats.reduce((s, d) => s + d.revenue, 0);

    await base44.entities.AdCampaign.update(campaign_id, {
      daily_stats: newStats,
      budget_spent: parseFloat(totalSpend.toFixed(2)),
      performance: {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        ctr: parseFloat((totalClicks / totalImpressions * 100).toFixed(3)),
        cpc: parseFloat((totalSpend / totalClicks).toFixed(2)),
        cpa: totalConversions > 0 ? parseFloat((totalSpend / totalConversions).toFixed(2)) : 0,
        roas: parseFloat((totalRevenue / totalSpend).toFixed(2)),
        revenue_generated: parseFloat(totalRevenue.toFixed(2)),
        avg_ltv: parseFloat((totalRevenue / (totalConversions || 1) * 3.2).toFixed(2)),
        churn_rate: parseFloat((15 + Math.random() * 20).toFixed(1))
      }
    });

    return Response.json({ success: true, stats: newStats });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});