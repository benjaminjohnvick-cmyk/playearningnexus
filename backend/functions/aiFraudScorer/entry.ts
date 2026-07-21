import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity automation triggered on PPCSurveyResponse create
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.id || !data?.survey_id) {
      return Response.json({ error: 'Missing response data' }, { status: 400 });
    }

    const response = data;
    const survey = await base44.asServiceRole.entities.PPCSurvey.get(response.survey_id);
    if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });

    // Gather user history
    const [userResponses, userTransactions] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: response.user_id }),
      base44.asServiceRole.entities.PPCTransaction.filter({ user_id: response.user_id })
    ]);

    const prompt = `You are an AI fraud detection system for a survey platform. Analyze this survey response for fraud signals.

Survey Response Data:
- Time taken: ${response.time_taken_seconds}s (expected: ${(survey.questions?.length || 5) * 20}-${(survey.questions?.length || 5) * 60}s)
- Answers: ${JSON.stringify(response.answers)}
- Total questions: ${survey.questions?.length || 0}
- User total responses ever: ${userResponses.length}
- User total transactions: ${userTransactions.length}
- Already flagged as suspicious: ${response.is_flagged}
- Device fingerprint present: ${!!response.device_fingerprint}

Analyze for:
1. Speed fraud (too fast = bot)
2. Pattern fraud (all same answers = straight-lining)
3. Velocity fraud (too many responses in short time)
4. Account age vs activity ratio fraud

Return a risk score (0-100) and recommended action.`;

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          fraud_risk_score: { type: 'number' },
          fraud_reasons: { type: 'array', items: { type: 'string' } },
          fraud_action: { type: 'string' },
          analysis_summary: { type: 'string' }
        }
      }
    });

    const action = aiResult.fraud_risk_score >= 75 ? 'block' :
                   aiResult.fraud_risk_score >= 40 ? 'flag' : 'allow';

    await base44.asServiceRole.entities.PPCSurveyResponse.update(response.id, {
      fraud_risk_score: aiResult.fraud_risk_score,
      fraud_reasons: aiResult.fraud_reasons || [],
      fraud_action: action,
      is_flagged: action !== 'allow',
      is_blocked: action === 'block'
    });

    if (action !== 'allow') {
      await base44.asServiceRole.entities.FlaggedResponse.create({
        response_id: response.id,
        survey_id: response.survey_id,
        respondent_id: response.user_id,
        creator_id: survey.creator_user_id,
        flag_reasons: aiResult.fraud_reasons || [],
        severity: action === 'block' ? 'high' : 'medium',
        details: { ai_score: aiResult.fraud_risk_score, summary: aiResult.analysis_summary }
      });
    }

    return Response.json({ success: true, action, risk_score: aiResult.fraud_risk_score });
  } catch (error) {
    console.error('AI fraud scorer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});