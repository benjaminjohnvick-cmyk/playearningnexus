import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch completed A/B tests
    const tests = await base44.entities.ABTest.filter({
      status: 'completed'
    }, '-created_date', 50);

    let winnersDeployed = 0;
    const results = [];

    for (const test of tests) {
      try {
        // Analyze test results
        const testAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze A/B test results and declare statistical winner.

Test: ${test.name}
Control Results: ${test.control_metric_value}
Variant Results: ${test.variant_metric_value}
Sample Size: ${test.sample_size}
Metric: ${test.metric_tracked}
Confidence Level: ${test.statistical_confidence || '95'}%

Return JSON with:
1. winner: "control", "variant", "no_winner"
2. statistical_significance: boolean
3. lift_percent: performance improvement percentage
4. recommendation: specific action to take
5. deploy_confidence: 0-100
6. requires_human_review: boolean (if close or low sample)`,
          response_json_schema: {
            type: 'object',
            properties: {
              winner: { type: 'string' },
              statistical_significance: { type: 'boolean' },
              lift_percent: { type: 'number' },
              recommendation: { type: 'string' },
              deploy_confidence: { type: 'number' },
              requires_human_review: { type: 'boolean' }
            }
          }
        });

        // Auto-deploy if high confidence winner
        if (testAnalysis.winner !== 'no_winner' && 
            testAnalysis.deploy_confidence >= 85 &&
            testAnalysis.statistical_significance &&
            !testAnalysis.requires_human_review) {
          await base44.entities.ABTest.update(test.id, {
            status: 'deployed',
            winner: testAnalysis.winner,
            deployed_date: new Date().toISOString()
          });
          winnersDeployed++;
        }

        results.push({
          test_id: test.id,
          test_name: test.name,
          winner: testAnalysis.winner,
          lift: testAnalysis.lift_percent,
          confidence: testAnalysis.deploy_confidence,
          deployed: testAnalysis.winner !== 'no_winner' && testAnalysis.deploy_confidence >= 85,
          awaiting_review: testAnalysis.requires_human_review || testAnalysis.deploy_confidence < 85
        });
      } catch (error) {
        console.error(`Analysis failed for test ${test.id}:`, error);
      }
    }

    return Response.json({
      tests_analyzed: tests.length,
      winners_deployed: winnersDeployed,
      awaiting_review: results.filter(r => r.awaiting_review).length,
      results: results
    });
  } catch (error) {
    console.error('A/B test analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});