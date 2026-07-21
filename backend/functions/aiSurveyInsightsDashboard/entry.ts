import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AI Survey Insights Dashboard
 * Analyzes all survey responses for a business client's surveys,
 * returns sentiment analysis, theme clusters, trend data, and actionable recommendations.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { survey_id } = await req.json().catch(() => ({}));

    // Find business client for this user
    const clients = await base44.entities.BusinessClient.filter({ owner_user_id: user.id });
    if (!clients.length) return Response.json({ error: 'No business client found' }, { status: 403 });
    const client = clients[0];

    // Fetch surveys belonging to this client
    let surveys = [];
    if (survey_id) {
      const s = await base44.entities.PPCSurvey.filter({ id: survey_id });
      surveys = s;
    } else {
      surveys = await base44.entities.PPCSurvey.filter({ created_by: user.email }, '-created_date', 10);
    }

    if (!surveys.length) return Response.json({ error: 'No surveys found' }, { status: 404 });

    // Fetch all responses for these surveys
    const surveyIds = surveys.map(s => s.id);
    let allResponses = [];
    for (const sid of surveyIds.slice(0, 5)) {
      const responses = await base44.entities.PPCSurveyResponse.filter(
        { survey_id: sid, completed: true }, '-created_date', 100
      );
      allResponses = allResponses.concat(responses);
    }

    console.log(`Analyzing ${allResponses.length} responses across ${surveys.length} surveys`);

    // Extract text-based answers for sentiment & theme analysis
    const textResponses = allResponses
      .filter(r => r.answers && typeof r.answers === 'object')
      .slice(0, 200)
      .map(r => ({
        quality_score: r.quality_score,
        answers: Object.values(r.answers).filter(v => typeof v === 'string' && v.length > 10).join(' | ')
      }))
      .filter(r => r.answers);

    const avgQuality = allResponses.length > 0
      ? allResponses.reduce((s, r) => s + (r.quality_score || 70), 0) / allResponses.length : 0;

    const completionRate = allResponses.length > 0
      ? allResponses.filter(r => r.completed).length / allResponses.length * 100 : 0;

    // Run AI analysis
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a business intelligence AI. Analyze these survey responses for a business client and extract actionable insights.

Business Client: ${client.company_name}
Total Responses Analyzed: ${allResponses.length}
Average Quality Score: ${avgQuality.toFixed(1)}/100
Completion Rate: ${completionRate.toFixed(1)}%
Surveys Covered: ${surveys.map(s => s.title || s.id).join(', ')}

Sample Response Text (up to 50 responses):
${textResponses.slice(0, 50).map((r, i) => `[${i + 1}] Q:${r.quality_score} — ${r.answers.substring(0, 200)}`).join('\n')}

Provide a comprehensive analysis:
1. overall_sentiment — "positive" | "neutral" | "negative" | "mixed"
2. sentiment_score — 0 to 100 (100 = very positive)
3. top_themes — array of {theme, count, sentiment, representative_quote} — top 5 common topics mentioned
4. key_insights — array of 3-5 most important findings as strings
5. recommendations — array of 3-5 specific actionable recommendations for improving the survey or product
6. response_quality_summary — brief assessment of response quality
7. engagement_score — 0-100 overall engagement score
8. trend_summary — one sentence about trends in responses over time
9. nps_estimate — estimated Net Promoter Score (-100 to 100) based on responses
10. word_cloud_terms — array of {word, frequency} top 15 most mentioned terms`,
      response_json_schema: {
        type: 'object',
        properties: {
          overall_sentiment: { type: 'string' },
          sentiment_score: { type: 'number' },
          top_themes: { type: 'array', items: { type: 'object', properties: { theme: { type: 'string' }, count: { type: 'number' }, sentiment: { type: 'string' }, representative_quote: { type: 'string' } } } },
          key_insights: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          response_quality_summary: { type: 'string' },
          engagement_score: { type: 'number' },
          trend_summary: { type: 'string' },
          nps_estimate: { type: 'number' },
          word_cloud_terms: { type: 'array', items: { type: 'object', properties: { word: { type: 'string' }, frequency: { type: 'number' } } } }
        }
      }
    });

    // Save to AIFeedbackAnalysis entity
    await base44.asServiceRole.entities.AIFeedbackAnalysis.create({
      survey_id: survey_id || surveys[0].id,
      analysis_type: 'business_insights_dashboard',
      total_responses: allResponses.length,
      overall_sentiment: analysis?.overall_sentiment,
      sentiment_score: analysis?.sentiment_score,
      key_themes: analysis?.top_themes?.map(t => t.theme),
      insights: JSON.stringify(analysis),
      generated_at: new Date().toISOString()
    }).catch(() => {});

    return Response.json({
      success: true,
      meta: {
        total_responses: allResponses.length,
        surveys_analyzed: surveys.length,
        avg_quality_score: avgQuality,
        completion_rate: completionRate
      },
      analysis,
      surveys: surveys.map(s => ({ id: s.id, title: s.title, response_count: allResponses.filter(r => r.survey_id === s.id).length }))
    });

  } catch (error) {
    console.error('aiSurveyInsightsDashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});