import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { limit = 20 } = await req.json().catch(() => ({}));

    // Gather all context in parallel
    const [surveys, userResponses, trustScores] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 100),
      base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 200),
      base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: user.id }),
    ]);

    const completedIds = new Set(userResponses.filter(r => r.completed).map(r => r.survey_id));
    const available = surveys.filter(s => !completedIds.has(s.id));

    if (available.length === 0) return Response.json({ surveys: [], ranked: true });

    const trustScore = trustScores[0];
    const completedResponses = userResponses.filter(r => r.completed);

    // Build rich user interest profile
    const categoryFrequency = {};
    completedResponses.forEach(r => {
      const survey = surveys.find(s => s.id === r.survey_id);
      if (survey?.survey_type) {
        categoryFrequency[survey.survey_type] = (categoryFrequency[survey.survey_type] || 0) + 1;
      }
    });

    const avgTimeTaken = completedResponses.length > 0
      ? completedResponses.reduce((s, r) => s + (r.time_taken_seconds || 60), 0) / completedResponses.length
      : 60;

    const profile = {
      interests: user.interests || [],
      age_range: user.age_range || null,
      occupation: user.occupation || null,
      income_range: user.income_range || null,
      location: user.location || null,
      total_completed: completedResponses.length,
      avg_quality_score: trustScore?.response_quality_score || 70,
      avg_time_taken_seconds: Math.round(avgTimeTaken),
      trust_tier: trustScore?.trust_tier || 'medium',
      category_history: categoryFrequency,
      preferred_categories: Object.entries(categoryFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat),
    };

    const prompt = `You are a personalized survey recommendation AI for a PPC marketplace.
Rank ALL available surveys for this specific user, from most to least relevant.

Ranking criteria (in order of priority):
1. Demographic match (age, occupation, income, interests → product category alignment)
2. Category preference (user's completion history shows interest patterns)
3. Earnings per minute (cost_per_response / estimated completion time)
4. Quality fit (high quality users → prefer surveys with higher quality bar)
5. Diversity (don't cluster same category at top)

User Profile:
${JSON.stringify(profile, null, 2)}

Available Surveys (${available.length} total):
${available.slice(0, 50).map((s, i) => `Index ${i}: id="${s.id}" title="${s.title}" type="${s.survey_type}" cpr=$${s.cost_per_response} questions=${s.questions?.length || 5} avg_quality=${s.avg_quality_score || 0} avg_time=${s.avg_completion_time_seconds || 60}s`).join('\n')}

Return ranked indices (0-based) for the top ${Math.min(limit, available.length)} surveys with a brief match_reason and match_score (0-100) for each.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          ranked_surveys: {
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

    const ranked = (result.ranked_surveys || [])
      .slice(0, limit)
      .map(m => {
        const survey = available[m.survey_index];
        if (!survey) return null;
        return { ...survey, match_score: m.match_score, match_reason: m.match_reason, earning_estimate: m.earning_estimate };
      })
      .filter(Boolean);

    // Append any surveys not ranked by AI at the end
    const rankedIds = new Set(ranked.map(s => s.id));
    const remaining = available.filter(s => !rankedIds.has(s.id));
    const all = [...ranked, ...remaining];

    return Response.json({ surveys: all, ranked: true, profile_used: profile });
  } catch (error) {
    console.error('rankSurveysForUser error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});