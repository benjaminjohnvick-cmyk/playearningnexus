import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'analyze', campaign_id, target_roi, total_budget, user_segment } = body;

    if (action === 'analyze') {
      // Fetch all active ad listings for this user
      const ads = await base44.entities.AdListing.filter({ created_by: user.email });
      const transactions = await base44.asServiceRole.entities.AdTransaction.filter({ created_by: user.email });

      if (ads.length === 0) {
        return Response.json({ success: true, message: 'No ads found', allocations: [] });
      }

      // Compute per-ad performance
      const adMetrics = ads.map(ad => {
        const adTx = transactions.filter(t => t.ad_id === ad.id);
        const totalSpend = adTx.reduce((s, t) => s + (t.amount || 0), 0);
        const revenue = adTx.filter(t => t.transaction_type === 'conversion').reduce((s, t) => s + (t.amount || 0), 0);
        const roi = totalSpend > 0 ? ((revenue - totalSpend) / totalSpend) * 100 : 0;
        const clicks = ad.clicks || 0;
        const impressions = ad.impressions || 1;
        const ctr = (clicks / impressions) * 100;
        const conversions = ad.conversions || 0;
        const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
        return {
          ad_id: ad.id,
          title: ad.title || ad.name || 'Unnamed Ad',
          current_budget: ad.budget || 0,
          spend: totalSpend,
          revenue,
          roi: Math.round(roi),
          ctr: ctr.toFixed(2),
          conversion_rate: convRate.toFixed(2),
          impressions,
          clicks,
          conversions,
          targeting: ad.targeting || {},
        };
      });

      const prompt = `You are an expert digital advertising optimizer. Analyze these ad campaigns and reallocate budget to maximize ROI.

Advertiser's Target ROI: ${target_roi || 150}%
Total Available Budget: $${total_budget || adMetrics.reduce((s, a) => s + a.current_budget, 0)}
User Segment Focus: ${user_segment || 'all'}

Current Ad Performance:
${JSON.stringify(adMetrics, null, 2)}

Tasks:
1. Identify top-performing creatives by segment
2. Predict which ads will exceed target ROI
3. Reallocate budget from underperformers to top performers
4. Suggest creative improvements for underperforming ads
5. Estimate projected performance after reallocation

Respond in JSON:
{
  "summary": string,
  "platform_roi_forecast": number,
  "budget_allocations": [
    {
      "ad_id": string,
      "title": string,
      "recommended_budget": number,
      "budget_change_pct": number,
      "predicted_roi": number,
      "predicted_conversions": number,
      "reasoning": string,
      "action": "scale_up"|"maintain"|"pause"|"optimize"
    }
  ],
  "top_performing_segments": string[],
  "creative_recommendations": [
    { "ad_id": string, "issue": string, "fix": string }
  ],
  "projected_total_roi": number,
  "confidence_score": number
}`;

      const optimization = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            platform_roi_forecast: { type: 'number' },
            budget_allocations: { type: 'array', items: { type: 'object' } },
            top_performing_segments: { type: 'array', items: { type: 'string' } },
            creative_recommendations: { type: 'array', items: { type: 'object' } },
            projected_total_roi: { type: 'number' },
            confidence_score: { type: 'number' }
          }
        }
      });

      // Auto-apply budget reallocation to ads marked scale_up or pause
      for (const alloc of (optimization.budget_allocations || [])) {
        if (alloc.action === 'pause') {
          await base44.asServiceRole.entities.AdListing.update(alloc.ad_id, { status: 'paused', budget: 0 });
        } else if (alloc.action === 'scale_up' && alloc.recommended_budget > 0) {
          await base44.asServiceRole.entities.AdListing.update(alloc.ad_id, { budget: alloc.recommended_budget });
        }
      }

      return Response.json({ success: true, ad_metrics: adMetrics, optimization });
    }

    if (action === 'predict_creative') {
      // Predict which creative concept will perform best for a segment
      const { creative_concepts, segment_data } = body;
      const prompt = `You are an ad creative performance predictor. Given these ad concepts and user segment data, rank the creatives by predicted performance.

User Segment: ${JSON.stringify(segment_data || {})}
Creative Concepts: ${JSON.stringify(creative_concepts || [])}

Rank each creative by predicted CTR, conversion rate, and ROI for this segment. 

Respond in JSON:
{
  "rankings": [
    {
      "concept_index": number,
      "predicted_ctr": number,
      "predicted_conversion_rate": number,
      "predicted_roi": number,
      "strengths": string[],
      "weaknesses": string[],
      "best_for_segments": string[]
    }
  ],
  "winner_index": number,
  "winner_reasoning": string,
  "ab_test_recommendation": string
}`;

      const prediction = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            rankings: { type: 'array', items: { type: 'object' } },
            winner_index: { type: 'number' },
            winner_reasoning: { type: 'string' },
            ab_test_recommendation: { type: 'string' }
          }
        }
      });

      return Response.json({ success: true, prediction });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});