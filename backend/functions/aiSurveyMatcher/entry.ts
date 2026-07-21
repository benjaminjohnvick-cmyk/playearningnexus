import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_profile, completed_survey_ids, available_surveys } = await req.json();

  if (!available_surveys || available_surveys.length === 0) {
    return Response.json({ success: true, matches: [] });
  }

  const prompt = `You are an AI survey recommendation engine. Your job is to match a user with the best available surveys based on their profile and history.

User Profile:
- Total earnings: $${user_profile.total_earnings}
- Surveys completed: ${user_profile.surveys_completed}
- Interests: ${(user_profile.interests || []).join(', ') || 'not specified'}
- Age range: ${user_profile.age_range}
- Location: ${user_profile.location}

Already completed survey IDs: ${completed_survey_ids.join(', ') || 'none'}

Available surveys to rank:
${available_surveys.map((s, i) => `
${i + 1}. ID: ${s.id}
   Title: "${s.title}"
   Type: ${s.survey_type}
   Questions: ${s.questions}
   Payout per response: $${s.cost_per_response}
   Responses so far: ${s.responses_count} / ${s.sample_size}
`).join('\n')}

For each survey, provide:
1. A match_score (0-100) based on how likely this user is to enjoy and complete it
2. expected_earnings (in USD) - realistic expected payout
3. est_minutes - estimated time to complete
4. completion_likelihood (0-100) - probability user completes it
5. reason - 1 sentence explaining why it's a good match

Prioritize:
- Surveys NOT already completed by the user
- Surveys with high remaining capacity (responses_count < sample_size)
- Surveys that match user interests/demographics
- Higher-paying surveys for engaged users

Return ONLY surveys that are not in the completed_survey_ids list. Rank by match_score descending.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              survey_id: { type: "string" },
              title: { type: "string" },
              match_score: { type: "number" },
              expected_earnings: { type: "number" },
              est_minutes: { type: "number" },
              completion_likelihood: { type: "number" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  });

  return Response.json({ success: true, matches: result.matches || [] });
});