import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { limit = 3 } = await req.json().catch(() => ({}));

    // Gather context
    const [surveys, userResponses] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
      base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 100),
    ]);

    const completedIds = new Set(userResponses.filter(r => r.completed).map(r => r.survey_id));
    const available = surveys.filter(s => !completedIds.has(s.id));

    if (available.length === 0) return Response.json({ surveys: [] });

    const profile = {
      interests: user.interests || [],
      age_range: user.age_range || null,
      occupation: user.occupation || null,
      income_range: user.income_range || null,
      total_completed: userResponses.filter(r => r.completed).length,
      avg_quality: userResponses.length
        ? (userResponses.reduce((s, r) => s + (r.quality_score || 70), 0) / userResponses.length).toFixed(1)
        : 70,
      preferred_categories: [...new Set(userResponses.slice(0, 20).map(r => r.category).filter(Boolean))],
    };

    const prompt = `You are a survey-matching AI. Given a user profile and list of available surveys, rank the top ${limit} surveys by:
1. Match to user demographic profile (age, occupation, interests)
2. Highest earning potential per minute
3. High completion rate (easier = better match)
4. User hasn't completed it before

User Profile:
${JSON.stringify(profile, null, 2)}

Available Surveys (pick best ${limit}):
${available.slice(0, 20).map((s, i) => `${i}: id=${s.id} title="${s.title}" category=${s.survey_type} cost_per_response=$${s.cost_per_response} questions=${s.questions?.length || 5} avg_quality=${s.avg_quality_score}`).join('\n')}

Return the top ${limit} survey indices with a match_reason for each.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                survey_index: { type: 'number' },
                match_score: { type: 'number' },
                match_reason: { type: 'string' },
                earning_estimate: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const matched = (result.matches || []).slice(0, limit).map(m => {
      const survey = available[m.survey_index];
      if (!survey) return null;
      return {
        ...survey,
        match_score: m.match_score,
        match_reason: m.match_reason,
        earning_estimate: m.earning_estimate,
      };
    }).filter(Boolean);

    return Response.json({ surveys: matched });
  } catch (error) {
    console.error('Survey match engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});