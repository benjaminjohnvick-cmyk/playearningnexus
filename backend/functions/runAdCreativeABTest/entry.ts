import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, test_id, variants, test_name, campaign_id, total_budget } = await req.json();

    // ACTION: create — generate AI variants and start test
    if (action === 'create') {
      if (!variants || variants.length < 2) {
        return Response.json({ error: 'Need at least 2 variants to run an A/B test' }, { status: 400 });
      }

      // Use AI to rewrite headlines and suggest image improvements for each variant
      const enhancedVariants = await Promise.all(variants.map(async (v, i) => {
        const aiEnhancement = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a high-converting ad copywriter. Rewrite this ad headline to maximize click-through rate for a gaming/tech audience.

Original headline: "${v.headline}"
Ad context: Gaming platform, affiliate marketing, digital rewards

Provide:
1. A rewritten headline (max 60 chars, punchy, action-oriented)
2. A/B test label (Variant A, B, C...)
3. Key change rationale (1 sentence)

Return JSON only.`,
          response_json_schema: {
            type: 'object',
            properties: {
              rewritten_headline: { type: 'string' },
              rationale: { type: 'string' }
            }
          }
        });

        return {
          ...v,
          variant_id: `var_${i + 1}_${Date.now()}`,
          label: `Variant ${String.fromCharCode(65 + i)}`,
          ai_rewritten_headline: aiEnhancement.rewritten_headline,
          budget_allocation_pct: Math.floor(100 / variants.length),
          impressions: 0,
          clicks: 0,
          ctr: 0,
          conversions: 0,
          spend: 0
        };
      }));

      const test = await base44.asServiceRole.entities.AdCreativeTest.create({
        test_name: test_name || `Creative Test ${new Date().toLocaleDateString()}`,
        owner_user_id: user.id,
        campaign_id: campaign_id || null,
        status: 'running',
        variants: enhancedVariants,
        total_budget: total_budget || 100,
        auto_reallocate: true,
        confidence_threshold: 85,
        started_at: new Date().toISOString()
      });

      return Response.json({
        success: true,
        test_id: test.id,
        variants_created: enhancedVariants.length,
        status: 'running',
        message: `A/B test started with ${enhancedVariants.length} AI-enhanced variants`
      });
    }

    // ACTION: optimize — analyze performance and reallocate budget
    if (action === 'optimize') {
      if (!test_id) return Response.json({ error: 'Missing test_id' }, { status: 400 });

      const tests = await base44.asServiceRole.entities.AdCreativeTest.filter({ id: test_id });
      const test = tests[0];
      if (!test) return Response.json({ error: 'Test not found' }, { status: 404 });

      const variants = test.variants || [];
      const hasEnoughData = variants.every(v => (v.impressions || 0) >= 30);

      if (!hasEnoughData) {
        return Response.json({ success: true, message: 'Not enough data yet for optimization', optimized: false });
      }

      // AI analysis of variant performance
      const variantSummary = variants.map(v => ({
        id: v.variant_id,
        label: v.label,
        headline: v.ai_rewritten_headline || v.headline,
        impressions: v.impressions || 0,
        clicks: v.clicks || 0,
        ctr: v.impressions > 0 ? ((v.clicks / v.impressions) * 100).toFixed(2) : 0,
        conversions: v.conversions || 0,
        spend: v.spend || 0
      }));

      const aiAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analyze these ad creative A/B test results and recommend budget reallocation.

Variants:
${JSON.stringify(variantSummary, null, 2)}

Provide:
1. Winner variant_id
2. Confidence % (0-100) in winner
3. New budget allocations (must sum to 100%)
4. Key insights
5. Whether to conclude the test (if confidence >= 85)

Return JSON only.`,
        response_json_schema: {
          type: 'object',
          properties: {
            winner_variant_id: { type: 'string' },
            confidence: { type: 'number' },
            new_allocations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  variant_id: { type: 'string' },
                  allocation_pct: { type: 'number' }
                }
              }
            },
            insights: { type: 'string' },
            conclude_test: { type: 'boolean' }
          }
        }
      });

      // Apply new budget allocations
      const updatedVariants = variants.map(v => {
        const newAlloc = (aiAnalysis.new_allocations || []).find(a => a.variant_id === v.variant_id);
        return {
          ...v,
          budget_allocation_pct: newAlloc ? newAlloc.allocation_pct : v.budget_allocation_pct
        };
      });

      const shouldConclude = aiAnalysis.conclude_test && aiAnalysis.confidence >= (test.confidence_threshold || 85);

      await base44.asServiceRole.entities.AdCreativeTest.update(test_id, {
        variants: updatedVariants,
        ai_winner: shouldConclude ? aiAnalysis.winner_variant_id : test.ai_winner,
        ai_insights: aiAnalysis.insights,
        status: shouldConclude ? 'concluded' : 'running',
        ...(shouldConclude ? { concluded_at: new Date().toISOString() } : {})
      });

      return Response.json({
        success: true,
        test_id,
        winner: aiAnalysis.winner_variant_id,
        confidence: aiAnalysis.confidence,
        concluded: shouldConclude,
        reallocated: true,
        insights: aiAnalysis.insights
      });
    }

    return Response.json({ error: 'Invalid action. Use: create | optimize' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});