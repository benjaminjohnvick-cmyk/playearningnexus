import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'generate', game_id, game_title, game_category, feedback_goal, existing_reviews, existing_ratings } = body;

    if (action === 'generate') {
      // Gather existing user data for context
      let contextReviews = existing_reviews || [];
      let contextRatings = existing_ratings || [];

      if (game_id) {
        const [reviews, ratings] = await Promise.all([
          base44.asServiceRole.entities.GameReview.filter({ game_id }),
          base44.asServiceRole.entities.GameRating.filter({ game_id }),
        ]);
        contextReviews = reviews.map(r => r.review || '').filter(Boolean);
        contextRatings = ratings.map(r => ({ rating: r.rating, review: r.review }));
      }

      const avgRating = contextRatings.length
        ? contextRatings.reduce((s, r) => s + r.rating, 0) / contextRatings.length
        : null;

      const prompt = `You are a game UX researcher creating a targeted feedback survey for an existing game based on real user feedback.

Game: "${game_title}" (${game_category || 'general'})
Developer's Feedback Goal: ${feedback_goal || 'improve overall user experience'}
Current Average Rating: ${avgRating ? avgRating.toFixed(1) + '/5' : 'No ratings yet'}
Existing User Reviews (${contextReviews.length}):
${contextReviews.slice(0, 15).join('\n')}
Rating Details: ${JSON.stringify(contextRatings.slice(0, 10))}

Based on this user data, generate a highly targeted feedback survey that:
1. Digs into specific pain points mentioned in reviews
2. Validates potential improvement directions
3. Prioritizes the developer's feedback goal
4. Uncovers hidden issues not mentioned in reviews
5. Collects data to inform future game design decisions

Respond in JSON:
{
  "survey_title": string,
  "survey_description": string,
  "focus_areas": string[],
  "questions": [
    {
      "id": string,
      "question": string,
      "type": "multiple_choice"|"rating"|"open_text"|"yes_no"|"ranking",
      "options": string[] | null,
      "required": boolean,
      "insight_goal": string,
      "triggered_by": string
    }
  ],
  "estimated_completion_minutes": number,
  "key_hypothesis": string,
  "expected_insights": string[]
}`;

      const survey = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            survey_title: { type: 'string' },
            survey_description: { type: 'string' },
            focus_areas: { type: 'array', items: { type: 'string' } },
            questions: { type: 'array', items: { type: 'object' } },
            estimated_completion_minutes: { type: 'number' },
            key_hypothesis: { type: 'string' },
            expected_insights: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Save as active PPCSurvey for user distribution
      const savedSurvey = await base44.asServiceRole.entities.PPCSurvey.create({
        title: survey.survey_title,
        description: survey.survey_description,
        category: game_category || 'casual',
        status: 'active',
        reward_amount: 0.15,
        questions: survey.questions,
        created_by: user.email,
        developer_id: user.id,
        game_id: game_id || null,
        is_feedback_survey: true,
        game_title: game_title,
      });

      // Save all feedback data for AI game creator
      await base44.asServiceRole.entities.DailyFeedbackSurvey.create({
        date: new Date().toISOString().split('T')[0],
        title: survey.survey_title,
        description: survey.survey_description,
        status: 'active',
        comparisons: [],
        source_analysis_id: savedSurvey.id,
      });

      return Response.json({
        success: true,
        survey_id: savedSurvey.id,
        survey,
        message: 'Feedback survey generated and live for GamerGain users',
      });
    }

    if (action === 'analyze_feedback') {
      const { survey_id } = body;
      if (!survey_id) return Response.json({ error: 'survey_id required' }, { status: 400 });

      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ survey_id });
      if (responses.length === 0) {
        return Response.json({ success: true, responses_count: 0, message: 'No responses yet' });
      }

      const prompt = `Analyze ${responses.length} user feedback responses for game "${game_title}" and provide actionable development insights.

Responses: ${JSON.stringify(responses.slice(0, 30))}

Provide:
1. Key themes from user feedback
2. Most requested features/improvements
3. Critical bugs or UX issues mentioned
4. Sentiment breakdown
5. Prioritized action plan for the developer
6. Data-driven game improvement roadmap

Respond in JSON:
{
  "sentiment_breakdown": { "positive": number, "neutral": number, "negative": number },
  "key_themes": string[],
  "top_requested_features": string[],
  "critical_issues": string[],
  "user_quotes": string[],
  "action_plan": [{ "priority": "critical"|"high"|"medium"|"low", "action": string, "rationale": string, "effort": string }],
  "improvement_roadmap": { "immediate": string[], "short_term": string[], "long_term": string[] },
  "nps_estimate": number,
  "summary": string
}`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            sentiment_breakdown: { type: 'object' },
            key_themes: { type: 'array', items: { type: 'string' } },
            top_requested_features: { type: 'array', items: { type: 'string' } },
            critical_issues: { type: 'array', items: { type: 'string' } },
            user_quotes: { type: 'array', items: { type: 'string' } },
            action_plan: { type: 'array', items: { type: 'object' } },
            improvement_roadmap: { type: 'object' },
            nps_estimate: { type: 'number' },
            summary: { type: 'string' }
          }
        }
      });

      // Save analysis as AIFeedbackAnalysis
      await base44.asServiceRole.entities.AIFeedbackAnalysis.create({
        survey_id,
        game_id: game_id || null,
        analysis: analysis,
        responses_analyzed: responses.length,
        created_by: user.email,
        analyzed_at: new Date().toISOString(),
      });

      return Response.json({ success: true, analysis, responses_count: responses.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});