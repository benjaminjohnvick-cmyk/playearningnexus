import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { campaign_id, dry_run = false } = body;

    // Fetch all active campaigns for this user (or specific one)
    const campaignFilter = campaign_id
      ? { id: campaign_id, owner_user_id: user.id }
      : { owner_user_id: user.id, status: 'active' };

    const campaigns = campaign_id
      ? [await base44.asServiceRole.entities.AdCampaign.get(campaign_id)].filter(Boolean)
      : await base44.asServiceRole.entities.AdCampaign.filter(campaignFilter, '-updated_date', 50);

    if (!campaigns.length) return Response.json({ success: true, message: 'No active campaigns found', actions: [] });

    // Fetch associated ad listings
    const allAds = await base44.asServiceRole.entities.AdListing.filter({ owner_user_id: user.id, status: 'active' }, '-updated_date', 100);

    // For each campaign, analyze ROAS and adjust
    const actions = [];
    const analysisData = campaigns.map(c => ({
      id: c.id,
      name: c.campaign_name || c.name || c.id,
      budget: c.budget || 0,
      spend: c.total_spent || 0,
      revenue: c.revenue_generated || 0,
      impressions: c.impressions || 0,
      clicks: c.clicks || 0,
      conversions: c.conversions || 0,
      roas: c.total_spent > 0 ? ((c.revenue_generated || 0) / c.total_spent).toFixed(2) : 0,
      ctr: c.impressions > 0 ? ((c.clicks || 0) / c.impressions * 100).toFixed(2) : 0,
    }));

    const adData = allAds.slice(0, 30).map(a => ({
      id: a.id,
      name: a.brand_name || a.title || a.id,
      bid: a.bid_amount || 0,
      spend: a.total_spent || 0,
      clicks: a.total_clicks || 0,
      conversions: a.surveys_completed || 0,
      status: a.status,
      ctr: a.total_clicks > 0 ? (((a.surveys_completed || 0) / a.total_clicks) * 100).toFixed(2) : 0,
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI performance marketing optimization engine for GamerGain. Analyze ad campaigns and make precise budget/bid adjustments to maximize ROAS.

CAMPAIGN PERFORMANCE DATA:
${JSON.stringify(analysisData, null, 2)}

AD CREATIVE PERFORMANCE:
${JSON.stringify(adData, null, 2)}

OPTIMIZATION RULES:
- Pause ads with CTR < 0.5% AND conversions = 0 AND spend > $5
- Increase budget 20% for campaigns with ROAS > 3.0
- Decrease budget 15% for campaigns with ROAS < 1.0 (still positive)
- Pause campaigns with ROAS < 0.5 (losing money)
- Pivot 30% of paused campaign budget to highest ROAS campaign
- Increase bid 10% on top-converting ad creatives (top 20% by conversions)
- Decrease bid 20% on bottom-performing creatives (bottom 20% by CTR)

Generate precise actions for each campaign and ad. Be specific with dollar amounts.

Respond as JSON:
{
  "campaign_actions": [
    {
      "campaign_id": string,
      "campaign_name": string,
      "current_roas": number,
      "action": "increase_budget" | "decrease_budget" | "pause" | "maintain",
      "budget_change_pct": number,
      "new_budget": number,
      "reasoning": string
    }
  ],
  "ad_actions": [
    {
      "ad_id": string,
      "ad_name": string,
      "action": "pause" | "increase_bid" | "decrease_bid" | "maintain",
      "bid_change_pct": number,
      "new_bid": number,
      "is_top_performer": boolean,
      "reasoning": string
    }
  ],
  "budget_pivot": {
    "from_campaigns": [string],
    "to_campaign_id": string,
    "pivot_amount": number,
    "reasoning": string
  },
  "overall_insights": string,
  "projected_roas_improvement": number
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          campaign_actions: { type: 'array', items: { type: 'object' } },
          ad_actions: { type: 'array', items: { type: 'object' } },
          budget_pivot: { type: 'object' },
          overall_insights: { type: 'string' },
          projected_roas_improvement: { type: 'number' },
        },
      },
    });

    // Apply actions unless dry_run
    if (!dry_run) {
      for (const action of result.campaign_actions || []) {
        if (action.action === 'pause') {
          await base44.asServiceRole.entities.AdCampaign.update(action.campaign_id, { status: 'paused' }).catch(() => {});
          actions.push({ type: 'paused_campaign', name: action.campaign_name, reason: action.reasoning });
        } else if (action.new_budget && action.action !== 'maintain') {
          await base44.asServiceRole.entities.AdCampaign.update(action.campaign_id, { budget: action.new_budget }).catch(() => {});
          actions.push({ type: 'budget_adjusted', name: action.campaign_name, new_budget: action.new_budget });
        }
      }

      for (const action of result.ad_actions || []) {
        if (action.action === 'pause') {
          await base44.asServiceRole.entities.AdListing.update(action.ad_id, { status: 'paused' }).catch(() => {});
          actions.push({ type: 'paused_ad', name: action.ad_name, reason: action.reasoning });
        } else if (action.new_bid && action.action !== 'maintain') {
          await base44.asServiceRole.entities.AdListing.update(action.ad_id, { bid_amount: action.new_bid }).catch(() => {});
          actions.push({ type: 'bid_adjusted', name: action.ad_name, new_bid: action.new_bid, is_top: action.is_top_performer });
        }
      }
    }

    return Response.json({
      success: true,
      dry_run,
      actions_taken: actions.length,
      actions,
      ...result,
      analyzed_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});