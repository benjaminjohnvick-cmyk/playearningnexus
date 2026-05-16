import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { game_title, game_description, game_category, platforms, demo_url, action = 'generate' } = body;

    if (!game_title) return Response.json({ error: 'game_title is required' }, { status: 400 });

    if (action === 'generate') {
      // AI generates a tailored pre-launch feedback survey
      const prompt = `You are a game market research expert. A developer is about to launch a game on GamerGain and wants to test it with users first.

Game Details:
- Title: ${game_title}
- Category: ${game_category || 'unknown'}
- Description: ${game_description || 'Not provided'}
- Platforms: ${(platforms || []).join(', ') || 'Not specified'}
- Demo URL: ${demo_url || 'Not provided'}

Generate a comprehensive pre-launch survey with 8-10 targeted questions to assess:
1. Market appeal and target audience fit
2. Gameplay experience and learning curve
3. Monetization acceptance (would they pay? how much?)
4. Viral potential and shareability
5. Competitive differentiation
6. Platform preference
7. Feature requests and deal-breakers

Include a mix of multiple choice, rating scales (1-5), and open-ended questions.

Respond in JSON:
{
  "survey_title": string,
  "survey_description": string,
  "target_audience": string,
  "estimated_completion_minutes": number,
  "questions": [
    {
      "id": string,
      "question": string,
      "type": "multiple_choice"|"rating"|"open_text"|"yes_no",
      "options": string[] | null,
      "required": boolean,
      "insight_goal": string
    }
  ],
  "success_metrics": { "min_rating": number, "min_interest_rate": number, "launch_recommendation_threshold": number },
  "market_analysis": string,
  "launch_risks": string[],
  "optimization_suggestions": string[]
}`;

      const survey = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            survey_title: { type: "string" },
            survey_description: { type: "string" },
            target_audience: { type: "string" },
            estimated_completion_minutes: { type: "number" },
            questions: { type: "array", items: { type: "object" } },
            success_metrics: { type: "object" },
            market_analysis: { type: "string" },
            launch_risks: { type: "array", items: { type: "string" } },
            optimization_suggestions: { type: "array", items: { type: "string" } }
          }
        }
      });

      // Save the survey as a PPCSurvey for distribution
      const savedSurvey = await base44.entities.PPCSurvey.create({
        title: survey.survey_title,
        description: survey.survey_description,
        category: game_category || 'casual',
        status: 'active',
        reward_amount: 0.25,
        questions: survey.questions,
        target_audience: survey.target_audience,
        created_by: user.email,
        developer_id: user.id,
        is_pre_launch: true,
        game_title: game_title,
      });

      return Response.json({
        success: true,
        survey_id: savedSurvey.id,
        survey,
        message: 'Pre-launch survey generated and activated for user testing'
      });
    }

    if (action === 'analyze_results') {
      const { survey_id } = body;
      if (!survey_id) return Response.json({ error: 'survey_id is required' }, { status: 400 });

      const responses = await base44.entities.PPCSurveyResponse.filter({ survey_id });

      if (responses.length === 0) {
        return Response.json({ success: true, message: 'No responses yet', responses_count: 0, ready_to_launch: false });
      }

      const prompt = `Analyze ${responses.length} pre-launch survey responses for game: "${game_title}" (${game_category}).

Response summary: ${JSON.stringify(responses.slice(0, 20))}

Provide a launch readiness assessment:
- Overall sentiment and market fit score (0-100)
- Key positive signals
- Key concerns or red flags
- Recommended improvements before launch
- Launch readiness verdict: "ready", "needs_work", or "not_ready"
- Projected retention rate
- Recommended target demographic

Respond in JSON:
{
  "market_fit_score": number,
  "launch_readiness": "ready"|"needs_work"|"not_ready",
  "sentiment": "positive"|"neutral"|"negative",
  "positive_signals": string[],
  "concerns": string[],
  "recommended_improvements": string[],
  "projected_retention": number,
  "target_demographic": string,
  "summary": string
}`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            market_fit_score: { type: "number" },
            launch_readiness: { type: "string" },
            sentiment: { type: "string" },
            positive_signals: { type: "array", items: { type: "string" } },
            concerns: { type: "array", items: { type: "string" } },
            recommended_improvements: { type: "array", items: { type: "string" } },
            projected_retention: { type: "number" },
            target_demographic: { type: "string" },
            summary: { type: "string" }
          }
        }
      });

      return Response.json({ success: true, analysis, responses_count: responses.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});