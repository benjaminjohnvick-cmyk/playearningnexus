import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, test_id } = body;

    if (action === 'analyze_feedback') {
      // Gather survey feedback and A/B test results
      const abTests = await base44.asServiceRole.entities.SurveyABTest.filter({ status: 'active' }, '-created_date', 20);
      const feedbackSurveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.list('-created_date', 10);
      const feedbackResponses = await base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 200);
      const featureMockups = await base44.asServiceRole.entities.FeatureMockup.list('-created_date', 30);

      // Aggregate response themes
      const responseThemes = {};
      for (const resp of feedbackResponses) {
        const rating = resp.overall_rating || 0;
        const comment = resp.open_feedback || '';
        if (comment) {
          const words = comment.toLowerCase().split(/\W+/).filter(w => w.length > 4);
          words.forEach(w => { responseThemes[w] = (responseThemes[w] || 0) + 1; });
        }
      }

      const topThemes = Object.entries(responseThemes).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));
      const avgRating = feedbackResponses.length > 0
        ? feedbackResponses.reduce((s, r) => s + (r.overall_rating || 0), 0) / feedbackResponses.length
        : 0;

      const prompt = `You are an AI product optimizer for GamerGain. Analyze survey feedback and A/B test data to recommend specific site changes.

PLATFORM FEEDBACK SUMMARY:
- Average Rating: ${avgRating.toFixed(1)}/5
- Total Responses: ${feedbackResponses.length}
- Top Feedback Themes: ${topThemes.map(t => `"${t.word}" (${t.count}x)`).join(', ')}

ACTIVE A/B TESTS:
${abTests.map(t => `- ${t.name} (${t.test_type}): A=${t.variant_a_completions || 0} convs, B=${t.variant_b_completions || 0} convs, confidence=${t.confidence_pct || 0}%`).join('\n')}

FEATURE MOCKUPS STATUS:
${featureMockups.map(f => `- ${f.feature_name} (${f.phase}): ${f.vote_count || 0} votes, ${f.top_response || 'pending'}`).join('\n')}

FEEDBACK SURVEYS:
${feedbackSurveys.map(s => `- ${s.question || s.title}: ${s.response_count || 0} responses`).join('\n')}

Based on this data, recommend:
1. Which A/B tests should be concluded and which variant should win
2. What site changes should be implemented based on feedback themes
3. New A/B tests to run based on feedback patterns
4. Feature priorities based on community votes
5. Dynamic site changes that can be auto-applied

Return JSON:
{
  "summary": "string",
  "ab_test_conclusions": [
    { "test_id": "string", "test_name": "string", "recommended_winner": "a|b|continue", "reason": "string", "confidence": number, "impact": "string" }
  ],
  "site_changes_recommended": [
    { "change": "string", "area": "string", "priority": "high|medium|low", "expected_impact": "string", "evidence": "string" }
  ],
  "new_tests_to_run": [
    { "name": "string", "test_type": "string", "hypothesis": "string", "variant_a": "string", "variant_b": "string" }
  ],
  "feature_priorities": [
    { "feature": "string", "priority_score": number, "reason": "string" }
  ],
  "auto_apply_changes": [
    { "change_type": "string", "description": "string", "safe_to_auto_apply": boolean }
  ],
  "overall_ux_health": number,
  "key_insight": "string"
}`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            ab_test_conclusions: { type: 'array', items: { type: 'object' } },
            site_changes_recommended: { type: 'array', items: { type: 'object' } },
            new_tests_to_run: { type: 'array', items: { type: 'object' } },
            feature_priorities: { type: 'array', items: { type: 'object' } },
            auto_apply_changes: { type: 'array', items: { type: 'object' } },
            overall_ux_health: { type: 'number' },
            key_insight: { type: 'string' }
          }
        }
      });

      // Auto-conclude A/B tests with high confidence
      for (const conclusion of (analysis.ab_test_conclusions || [])) {
        if (conclusion.confidence >= 95 && conclusion.recommended_winner !== 'continue') {
          const match = abTests.find(t => t.name === conclusion.test_name);
          if (match) {
            await base44.asServiceRole.entities.SurveyABTest.update(match.id, {
              status: 'completed',
              winner: conclusion.recommended_winner,
              ai_recommendation: conclusion.reason,
            }).catch(() => null);
          }
        }
      }

      return Response.json({ success: true, analysis, feedback_count: feedbackResponses.length, tests_analyzed: abTests.length });
    }

    if (action === 'run_test_optimizer') {
      const result = await base44.asServiceRole.functions.invoke('abTestAssigner', { action: 'optimize' });
      return Response.json({ success: true, result });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('aiFeedbackABOptimizer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});