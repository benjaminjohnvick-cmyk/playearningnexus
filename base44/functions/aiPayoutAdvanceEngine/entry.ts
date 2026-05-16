import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'analyze' } = body;

    // Fetch user's recent earnings history
    const [dailyEarnings, payouts, surveyResponses] = await Promise.all([
      base44.entities.DailyEarnings.filter({ user_id: user.id }),
      base44.entities.Payout.filter({ user_id: user.id }),
      base44.entities.PPCSurveyResponse.filter({ user_id: user.id }),
    ]);

    const totalEarnings = user.total_earnings || 0;
    const recentEarnings = dailyEarnings.slice(-30);
    const avgDailyEarning = recentEarnings.length > 0
      ? recentEarnings.reduce((s, d) => s + (d.amount || 0), 0) / recentEarnings.length
      : 0;

    const prompt = `You are an AI financial advisor for GamerGain, a survey/gaming rewards platform.

User Profile:
- Total Earnings: $${totalEarnings.toFixed(2)}
- Average Daily Earnings (last 30 days): $${avgDailyEarning.toFixed(4)}
- Survey Responses: ${surveyResponses.length}
- Completed Payouts: ${payouts.filter(p => p.status === 'completed').length}
- Account Age (days): ${Math.floor((Date.now() - new Date(user.created_date)) / 86400000)}

Tasks:
1. Predict their earning velocity for the next 7, 14, and 30 days
2. Determine if they qualify for an instant cash advance (trust score based on history, min $5 earned, min 7 days active, min 3 completed surveys)
3. Suggest 3 optimal payout windows with specific dates and reasoning
4. Assign a trust score 0-100

Respond in JSON with this exact structure:
{
  "trust_score": number,
  "qualifies_for_advance": boolean,
  "advance_amount": number,
  "advance_reasoning": string,
  "velocity_7d": number,
  "velocity_14d": number,
  "velocity_30d": number,
  "optimal_windows": [
    { "date": "YYYY-MM-DD", "predicted_balance": number, "reasoning": string }
  ],
  "retention_tip": string,
  "risk_level": "low"|"medium"|"high"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          trust_score: { type: "number" },
          qualifies_for_advance: { type: "boolean" },
          advance_amount: { type: "number" },
          advance_reasoning: { type: "string" },
          velocity_7d: { type: "number" },
          velocity_14d: { type: "number" },
          velocity_30d: { type: "number" },
          optimal_windows: { type: "array", items: { type: "object" } },
          retention_tip: { type: "string" },
          risk_level: { type: "string" }
        }
      }
    });

    // If action is 'request_advance', process the cash advance
    if (action === 'request_advance' && result.qualifies_for_advance) {
      await base44.entities.Payout.create({
        user_id: user.id,
        amount: result.advance_amount,
        method: 'paypal',
        payout_type: 'manual',
        status: 'pending',
        description: `AI Cash Advance - Trust Score: ${result.trust_score}`,
        notes: result.advance_reasoning,
      });
    }

    return Response.json({ success: true, analysis: result, user_earnings: totalEarnings, avg_daily: avgDailyEarning });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});