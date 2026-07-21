import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const test = data;
    if (!test?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Initialize A/B test — set start time, assign initial variant split
      await base44.asServiceRole.entities.ABTest.update(test.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        variant_a_count: 0,
        variant_b_count: 0
      });
    }

    if (event?.type === 'update' && data.status === 'completed') {
      // AI determine winner and generate insights
      const variantA = test.variant_a_conversions || 0;
      const variantB = test.variant_b_conversions || 0;
      const totalA = test.variant_a_count || 1;
      const totalB = test.variant_b_count || 1;
      const rateA = variantA / totalA;
      const rateB = variantB / totalB;

      const aiInsights = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this A/B test result for GamerGain:
        Test: "${test.name || test.hypothesis || 'Unnamed test'}"
        Variant A: ${variantA} conversions / ${totalA} users (rate: ${(rateA * 100).toFixed(2)}%)
        Variant B: ${variantB} conversions / ${totalB} users (rate: ${(rateB * 100).toFixed(2)}%)
        
        Return: winner (a/b/inconclusive), statistical_confidence (0-100), 
        key_insight (1-2 sentences), implementation_recommendation (string), 
        next_test_suggestion (string).`,
        response_json_schema: {
          type: "object",
          properties: {
            winner: { type: "string" },
            statistical_confidence: { type: "number" },
            key_insight: { type: "string" },
            implementation_recommendation: { type: "string" },
            next_test_suggestion: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.ABTest.update(test.id, {
        winner: aiInsights.winner,
        statistical_confidence: aiInsights.statistical_confidence,
        ai_insights: aiInsights.key_insight,
        implementation_recommendation: aiInsights.implementation_recommendation,
        concluded_at: new Date().toISOString()
      });

      // Notify admin of results
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 3)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'ab_test_concluded',
          title: `📊 A/B Test Complete: ${test.name || 'Test'}`,
          message: `Winner: ${aiInsights.winner.toUpperCase()} (${aiInsights.statistical_confidence}% confidence). ${aiInsights.key_insight}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});