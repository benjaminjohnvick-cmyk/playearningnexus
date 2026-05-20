import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent survey responses awaiting analysis
    const surveys = await base44.entities.PPCSurvey.filter({
      status: 'active'
    }, '-updated_date', 20);

    let insightsGenerated = 0;
    const results = [];

    for (const survey of surveys) {
      try {
        // Get responses for this survey
        const responses = await base44.entities.PPCSurveyResponse.filter({
          survey_id: survey.id
        }, '-created_date', 200);

        if (responses.length < 5) continue; // Need minimum data

        // Use AI to analyze patterns and generate insights
        const analysisPrompt = `Analyze these ${responses.length} survey responses and generate 3-5 actionable insights.

Survey: ${survey.title}
Product: ${survey.product_name}
Sample Size: ${responses.length}

Return JSON with:
1. key_themes: array of main themes identified
2. sentiment_breakdown: {positive: %, neutral: %, negative: %}
3. top_feature_requests: array of requested features
4. recommended_actions: array of specific business actions
5. confidence: 0-100`;

        const insights = await base44.integrations.Core.InvokeLLM({
          prompt: analysisPrompt,
          response_json_schema: {
            type: 'object',
            properties: {
              key_themes: { type: 'array', items: { type: 'string' } },
              sentiment_breakdown: {
                type: 'object',
                properties: {
                  positive: { type: 'number' },
                  neutral: { type: 'number' },
                  negative: { type: 'number' }
                }
              },
              top_feature_requests: { type: 'array', items: { type: 'string' } },
              recommended_actions: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'number' }
            }
          }
        });

        // Store insights (in production, create/update a SurveyInsights entity)
        if (insights.confidence >= 70) {
          insightsGenerated++;
        }

        results.push({
          survey_id: survey.id,
          survey_title: survey.title,
          responses_analyzed: responses.length,
          themes: insights.key_themes,
          sentiment: insights.sentiment_breakdown,
          confidence: insights.confidence,
          awaiting_review: insights.confidence < 85
        });
      } catch (error) {
        console.error(`Analysis failed for survey ${survey.id}:`, error);
      }
    }

    return Response.json({
      surveys_analyzed: surveys.length,
      insights_generated: insightsGenerated,
      awaiting_review: results.filter(r => r.awaiting_review).length,
      results: results
    });
  } catch (error) {
    console.error('Survey analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});