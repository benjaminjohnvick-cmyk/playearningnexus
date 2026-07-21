import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Analyzes active SurveyABTests, calculates statistical significance,
 * and auto-adjusts traffic split toward the winning variant.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { test_id } = body; // optional: single test

    const tests = test_id
      ? [await base44.asServiceRole.entities.SurveyABTest.filter({ id: test_id }).then(r => r[0])].filter(Boolean)
      : await base44.asServiceRole.entities.SurveyABTest.filter({ status: 'active' });

    const results = [];

    for (const test of tests) {
      const aImpressions = test.variant_a_impressions || 0;
      const bImpressions = test.variant_b_impressions || 0;
      const aCompletions = test.variant_a_completions || 0;
      const bCompletions = test.variant_b_completions || 0;
      const aRevenue = test.variant_a_revenue || 0;
      const bRevenue = test.variant_b_revenue || 0;

      if (aImpressions + bImpressions < 20) {
        results.push({ test_id: test.id, status: 'insufficient_data', message: 'Need 20+ impressions' });
        continue;
      }

      const aConvRate = aImpressions > 0 ? aCompletions / aImpressions : 0;
      const bConvRate = bImpressions > 0 ? bCompletions / bImpressions : 0;
      const aRPM = aImpressions > 0 ? (aRevenue / aImpressions) * 1000 : 0;
      const bRPM = bImpressions > 0 ? (bRevenue / bImpressions) * 1000 : 0;

      // Simple z-test for proportions
      const pooledRate = (aCompletions + bCompletions) / Math.max(1, aImpressions + bImpressions);
      const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / Math.max(1, aImpressions) + 1 / Math.max(1, bImpressions)));
      const zScore = se > 0 ? Math.abs(aConvRate - bConvRate) / se : 0;
      const confidencePct = Math.min(99, Math.round(
        zScore >= 2.58 ? 99 :
        zScore >= 1.96 ? 95 :
        zScore >= 1.645 ? 90 :
        zScore * 35
      ));

      let winner = 'pending';
      if (confidencePct >= 90) {
        if (aConvRate > bConvRate * 1.02) winner = 'a';
        else if (bConvRate > aConvRate * 1.02) winner = 'b';
        else winner = 'tie';
      }

      // Auto-optimize traffic split
      let newSplitA = test.traffic_split_a ?? 50;
      if (test.auto_optimize && winner !== 'pending' && winner !== 'tie') {
        if (winner === 'a') newSplitA = Math.min(90, newSplitA + 10);
        else newSplitA = Math.max(10, newSplitA - 10);
      }

      // AI recommendation
      let aiRecommendation = '';
      try {
        const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `A/B test results for survey "${test.name}":
Variant A: ${aImpressions} impressions, ${(aConvRate*100).toFixed(1)}% conversion, $${aRPM.toFixed(2)} RPM
Variant B: ${bImpressions} impressions, ${(bConvRate*100).toFixed(1)}% conversion, $${bRPM.toFixed(2)} RPM
Statistical confidence: ${confidencePct}%. Current winner: ${winner}.
Write one actionable sentence recommending next steps for this A/B test.`,
        });
        aiRecommendation = typeof ai === 'string' ? ai : ai?.toString() || '';
      } catch (_) {
        aiRecommendation = winner !== 'pending'
          ? `Variant ${winner.toUpperCase()} is leading with ${confidencePct}% confidence — consider stopping the test and deploying the winner.`
          : 'Continue running the test to collect more data.';
      }

      const shouldComplete = confidencePct >= 95 && winner !== 'pending' && winner !== 'tie';

      await base44.asServiceRole.entities.SurveyABTest.update(test.id, {
        winner,
        confidence_pct: confidencePct,
        traffic_split_a: newSplitA,
        ai_recommendation: aiRecommendation,
        ...(shouldComplete ? { status: 'completed', ended_at: new Date().toISOString() } : {}),
      });

      results.push({
        test_id: test.id,
        name: test.name,
        winner,
        confidence_pct: confidencePct,
        a_conv_rate: (aConvRate * 100).toFixed(2),
        b_conv_rate: (bConvRate * 100).toFixed(2),
        new_split_a: newSplitA,
        auto_completed: shouldComplete,
      });
    }

    return Response.json({ success: true, tests_analyzed: tests.length, results });
  } catch (error) {
    console.error('surveyABTestOptimizer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});