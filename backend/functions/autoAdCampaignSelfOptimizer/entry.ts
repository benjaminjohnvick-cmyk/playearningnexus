import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Scheduled daily: invoke AI optimization loop for all active AdCampaigns with ai_bid_enabled
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const results = [];
    const activeCampaigns = await base44.asServiceRole.entities.AdCampaign.filter({
      status: 'active',
      ai_bid_enabled: true
    });

    for (const campaign of activeCampaigns) {
      const perf = campaign.performance || {};
      const spend = campaign.budget_spent || 0;
      const budget = campaign.budget_total || 1;
      const spendPct = spend / budget;

      // Skip campaigns with no impressions yet
      if (!perf.impressions || perf.impressions < 100) continue;

      // AI analysis
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize this ad campaign for a gaming platform:
Campaign: "${campaign.name}" — Objective: ${campaign.objective}
Performance: CTR=${(perf.ctr || 0).toFixed(3)}%, CPC=$${(perf.cpc || 0).toFixed(2)}, Conversions=${perf.conversions || 0}, ROAS=${(perf.roas || 0).toFixed(2)}, CPA=$${(perf.cpa || 0).toFixed(2)}
Budget: $${spend.toFixed(2)} spent of $${budget} total (${(spendPct * 100).toFixed(0)}%)
Current bid: $${campaign.bid_amount || 'auto'}, Strategy: ${campaign.bid_strategy}
Target audience: ${JSON.stringify(campaign.demographics || {})}

Provide: recommended_bid (number), audience_score (0-100), predicted_ctr (decimal), predicted_conversions (integer), optimization_tips (array of 3 short tips).`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_bid: { type: 'number' },
            audience_score: { type: 'number' },
            predicted_ctr: { type: 'number' },
            predicted_conversions: { type: 'number' },
            optimization_tips: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Update campaign with AI suggestions
      await base44.asServiceRole.entities.AdCampaign.update(campaign.id, {
        ai_suggestions: {
          recommended_bid: aiResult.recommended_bid,
          audience_score: aiResult.audience_score,
          predicted_ctr: aiResult.predicted_ctr,
          predicted_conversions: aiResult.predicted_conversions,
          optimization_tips: aiResult.optimization_tips,
          generated_at: new Date().toISOString()
        },
        last_optimized_at: new Date().toISOString(),
        // Auto-adjust bid if using auto strategy and AI has a better recommendation
        bid_amount: campaign.bid_strategy === 'auto_maximize_clicks' ? aiResult.recommended_bid : campaign.bid_amount
      });

      // Auto-pause campaigns burning budget with zero conversions
      if (spendPct > 0.3 && (perf.conversions || 0) === 0 && (perf.ctr || 0) < 0.001) {
        await base44.asServiceRole.entities.AdCampaign.update(campaign.id, { status: 'paused' });
        await base44.asServiceRole.entities.Notification.create({
          user_id: campaign.advertiser_id,
          type: 'campaign_auto_paused',
          title: `⏸️ Campaign Auto-Paused: "${campaign.name}"`,
          message: `AI paused your campaign after spending $${spend.toFixed(2)} with 0 conversions. Review the optimization tips in your campaign dashboard.`,
          is_read: false
        });
      } else if (aiResult.audience_score < 30) {
        // Notify low-performing campaigns
        await base44.asServiceRole.entities.Notification.create({
          user_id: campaign.advertiser_id,
          type: 'campaign_low_performance',
          title: `📊 Campaign Needs Attention: "${campaign.name}"`,
          message: `AI audience score: ${aiResult.audience_score}/100. Top tip: ${aiResult.optimization_tips?.[0] || 'Review targeting settings.'}`,
          is_read: false
        });
      }

      results.push(campaign.id);
    }

    return Response.json({ ok: true, campaigns_optimized: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});