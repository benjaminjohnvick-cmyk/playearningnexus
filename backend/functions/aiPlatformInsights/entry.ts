import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// On-demand: generates AI insights across the full platform
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [surveys, responses, transactions, referrals, flagged] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.list('-created_date', 50),
      base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 200),
      base44.asServiceRole.entities.PPCTransaction.list('-created_date', 200),
      base44.asServiceRole.entities.Referral.list('-created_date', 100),
      base44.asServiceRole.entities.FlaggedResponse.list('-created_date', 50)
    ]);

    const totalRevenue = transactions.filter(t => t.transaction_type === 'survey_charge')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const fraudRate = responses.length > 0
      ? ((responses.filter(r => r.is_flagged).length / responses.length) * 100).toFixed(1)
      : 0;

    const prompt = `You are an AI business analyst for GamerGain, a survey and gaming rewards platform. Analyze this platform data and provide actionable insights.

PLATFORM METRICS (last period):
- Total Active Surveys: ${surveys.filter(s => s.status === 'active').length}
- Total Surveys Created: ${surveys.length}
- Total Survey Responses: ${responses.length}
- Fraud Rate: ${fraudRate}%
- Total Revenue (survey charges): $${totalRevenue.toFixed(2)}
- Total Referrals: ${referrals.length}
- Flagged Responses: ${flagged.length}
- Active Referral Campaigns needed: true

TOP SURVEY TYPES:
${Object.entries(surveys.reduce((acc, s) => { acc[s.survey_type] = (acc[s.survey_type] || 0) + 1; return acc; }, {})).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Provide:
1. Key performance insights
2. Warning signals (if any)
3. Growth opportunities
4. Recommended immediate actions
5. 30-day revenue forecast
6. Fraud prevention recommendations`;

    const insights = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          key_insights: { type: 'array', items: { type: 'string' } },
          warning_signals: { type: 'array', items: { type: 'string' } },
          growth_opportunities: { type: 'array', items: { type: 'string' } },
          immediate_actions: { type: 'array', items: { type: 'string' } },
          revenue_forecast_30d: { type: 'string' },
          fraud_recommendations: { type: 'array', items: { type: 'string' } },
          health_score: { type: 'number' }
        }
      }
    });

    return Response.json({
      success: true,
      insights,
      metrics: {
        total_surveys: surveys.length,
        active_surveys: surveys.filter(s => s.status === 'active').length,
        total_responses: responses.length,
        fraud_rate: fraudRate,
        total_revenue: totalRevenue,
        total_referrals: referrals.length,
        flagged_responses: flagged.length
      }
    });
  } catch (error) {
    console.error('AI platform insights error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});