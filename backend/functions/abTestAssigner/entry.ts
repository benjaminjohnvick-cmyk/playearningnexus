import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * A/B Test Assigner
 * - Randomly assigns a user to variant A or B for a given test
 * - Logs the assignment and tracks conversion rates
 * - Also runs optimization: shifts traffic to winning variant if confidence >= 85%
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { test_id, user_id, action } = body;

    // ACTION: assign — return which variant to show this user
    if (action === 'assign' || !action) {
      if (!test_id) return Response.json({ success: true, message: 'No test ID provided, returning default variant' }, { status: 200 });
      const tests = await base44.asServiceRole.entities.SurveyABTest.filter({ id: test_id });
      const test = tests[0];
      if (!test) return Response.json({ success: true, variant: 'a', message: 'Test not found, returning default variant' }, { status: 200 });
      if (test.status !== 'active') return Response.json({ variant: 'a', test });

      // Determine split: traffic_split_a = % going to A
      const splitA = test.traffic_split_a ?? 50;
      const variant = Math.random() * 100 < splitA ? 'a' : 'b';

      // Increment impression count
      const updateData = variant === 'a'
        ? { variant_a_impressions: (test.variant_a_impressions || 0) + 1 }
        : { variant_b_impressions: (test.variant_b_impressions || 0) + 1 };
      await base44.asServiceRole.entities.SurveyABTest.update(test_id, updateData);

      return Response.json({ variant, test_id, split_a: splitA });
    }

    // ACTION: convert — record a completion for a variant
    if (action === 'convert') {
      const { variant } = body;
      const tests = await base44.asServiceRole.entities.SurveyABTest.filter({ id: test_id });
      const test = tests[0];
      if (!test) return Response.json({ error: 'Test not found' }, { status: 404 });

      const updateData = variant === 'a'
        ? { variant_a_completions: (test.variant_a_completions || 0) + 1 }
        : { variant_b_completions: (test.variant_b_completions || 0) + 1 };
      await base44.asServiceRole.entities.SurveyABTest.update(test_id, updateData);

      return Response.json({ success: true, variant, test_id });
    }

    // ACTION: optimize — analyze all active tests and shift traffic / declare winners
    if (action === 'optimize') {
      let user = null;
      try { user = await base44.auth.me(); } catch {}
      if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const activeTests = await base44.asServiceRole.entities.SurveyABTest.filter({ status: 'active' });
      const optimized = [];

      for (const test of activeTests) {
        const aImpressions = test.variant_a_impressions || 0;
        const bImpressions = test.variant_b_impressions || 0;
        const aConversions = test.variant_a_completions || 0;
        const bConversions = test.variant_b_completions || 0;

        if (aImpressions < 30 || bImpressions < 30) continue; // Not enough data

        const aRate = aConversions / aImpressions;
        const bRate = bConversions / bImpressions;
        const totalConversions = aConversions + bConversions;
        const totalImpressions = aImpressions + bImpressions;

        // Simple confidence calculation (chi-squared proxy)
        const expectedA = totalConversions * (aImpressions / totalImpressions);
        const expectedB = totalConversions * (bImpressions / totalImpressions);
        const chiSq = expectedA > 0 && expectedB > 0
          ? Math.pow(aConversions - expectedA, 2) / expectedA + Math.pow(bConversions - expectedB, 2) / expectedB
          : 0;
        const confidence = Math.min(99, Math.round(chiSq * 30));

        let winner = 'pending';
        let newSplitA = test.traffic_split_a || 50;

        if (confidence >= 85) {
          winner = aRate >= bRate ? 'a' : 'b';
          // Auto-scale: shift 70% traffic to winner
          newSplitA = winner === 'a' ? 75 : 25;
        } else if (confidence >= 60 && test.auto_optimize) {
          // Soft shift toward better performer
          newSplitA = aRate >= bRate
            ? Math.min(70, (test.traffic_split_a || 50) + 5)
            : Math.max(30, (test.traffic_split_a || 50) - 5);
        }

        // Use AI for recommendation
        const aiRec = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `A/B test "${test.name}" results:
Variant A: ${aConversions}/${aImpressions} (${Math.round(aRate * 100)}% conversion)
Variant B: ${bConversions}/${bImpressions} (${Math.round(bRate * 100)}% conversion)
Statistical confidence: ${confidence}%

Variant A: ${JSON.stringify(test.variant_a)}
Variant B: ${JSON.stringify(test.variant_b)}

In 1 sentence, recommend which variant to scale and why.`,
        });

        await base44.asServiceRole.entities.SurveyABTest.update(test.id, {
          winner: winner !== 'pending' ? winner : test.winner,
          confidence_pct: confidence,
          traffic_split_a: newSplitA,
          ai_recommendation: typeof aiRec === 'string' ? aiRec : aiRec?.text || '',
          status: winner !== 'pending' && confidence >= 95 ? 'completed' : 'active',
        });

        optimized.push({ test_id: test.id, name: test.name, winner, confidence, newSplitA, aRate: Math.round(aRate * 100), bRate: Math.round(bRate * 100) });
      }

      return Response.json({ success: true, tests_optimized: optimized.length, results: optimized });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});