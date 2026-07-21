import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { survey_id } = body;

    // Get the survey
    const surveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ id: survey_id });
    if (!surveys.length) return Response.json({ error: 'Survey not found' }, { status: 404 });
    const survey = surveys[0];

    // Get all responses
    const responses = await base44.asServiceRole.entities.FeedbackSurveyResponse.filter({ survey_id });
    if (responses.length === 0) return Response.json({ error: 'No responses to analyze' }, { status: 400 });

    // Create analysis record
    const analysis = await base44.asServiceRole.entities.AIFeedbackAnalysis.create({
      survey_id,
      survey_date: survey.date,
      total_responses_analyzed: responses.length,
      status: 'running',
      run_at: new Date().toISOString()
    });

    // Aggregate answers by category and question
    const aggregated = {};
    for (const response of responses) {
      for (const answer of (response.answers || [])) {
        const cat = answer.category || 'General';
        if (!aggregated[cat]) aggregated[cat] = [];
        aggregated[cat].push({ question: answer.question, answer: answer.answer, rating: answer.rating });
      }
    }

    const prompt = `You are an expert product analyst for GamerGain, a gaming platform. Analyze the following aggregated user feedback collected from ${responses.length} users today (${survey.date}).

AGGREGATED FEEDBACK BY CATEGORY:
${JSON.stringify(aggregated, null, 2)}

SURVEY FOCUS AREAS: ${(survey.focus_areas || []).join(', ')}

Based on this data, provide:
1. Key insights (what users love, what frustrates them)
2. A satisfaction score (0-10) for each category mentioned
3. Specific, actionable recommended changes ranked by priority
4. An overall sentiment summary

For recommended_changes, be specific about what should change in the product. Examples:
- "Increase default payout threshold from $X to $Y"
- "Add a progress bar to the survey taking flow"
- "Send daily earning reminders via push notification"
- "Simplify the referral link generation to one click"

Return JSON:
{
  "key_insights": ["insight1", "insight2", ...],
  "category_scores": { "CategoryName": 7.5, ... },
  "sentiment_summary": "Overall summary paragraph...",
  "recommended_changes": [
    {
      "id": "change_1",
      "category": "Feature area",
      "priority": "high|medium|low|critical",
      "title": "Short title",
      "description": "What to change",
      "rationale": "Why based on feedback data",
      "affected_area": "Which part of the app",
      "implementation_notes": "How this could be implemented",
      "status": "pending_review"
    }
  ]
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: "object",
        properties: {
          key_insights: { type: "array", items: { type: "string" } },
          category_scores: { type: "object" },
          sentiment_summary: { type: "string" },
          recommended_changes: { type: "array", items: { type: "object" } }
        }
      }
    });

    await base44.asServiceRole.entities.AIFeedbackAnalysis.update(analysis.id, {
      key_insights: result.key_insights || [],
      category_scores: result.category_scores || {},
      sentiment_summary: result.sentiment_summary || '',
      recommended_changes: result.recommended_changes || [],
      status: 'completed'
    });

    return Response.json({ success: true, analysis_id: analysis.id, changes_count: result.recommended_changes?.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});