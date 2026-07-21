import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { user_id } = body;
    const targetUserId = user_id || user.id;

    // Fetch earning history
    const transactions = await base44.asServiceRole.entities.PPCTransaction.filter(
      { user_id: targetUserId }, '-created_date', 200
    );
    const payouts = await base44.asServiceRole.entities.Payout.filter(
      { user_id: targetUserId }, '-created_date', 50
    );

    // Calculate velocity
    const now = Date.now();
    const day = 86400000;
    const last7 = transactions.filter(t => now - new Date(t.created_date) < 7 * day);
    const last30 = transactions.filter(t => now - new Date(t.created_date) < 30 * day);
    const earn7 = last7.reduce((s, t) => s + (t.amount || 0), 0);
    const earn30 = last30.reduce((s, t) => s + (t.amount || 0), 0);
    const dailyVelocity = earn7 / 7;
    const totalEarned = transactions.reduce((s, t) => s + (t.amount || 0), 0);
    const totalPaidOut = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const availableBalance = Math.max(0, totalEarned - totalPaidOut);

    // Day-by-day earning history for velocity chart (last 30 days)
    const velocityData = Array.from({ length: 30 }, (_, i) => {
      const dayStart = new Date(now - (29 - i) * day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + day);
      const dayEarnings = transactions.filter(t => {
        const ts = new Date(t.created_date);
        return ts >= dayStart && ts < dayEnd;
      }).reduce((s, t) => s + (t.amount || 0), 0);
      return { day: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`, earnings: parseFloat(dayEarnings.toFixed(2)) };
    });

    const prompt = `You are an AI financial advisor for GamerGain developers. Analyze this developer's earning data and recommend optimal payout timing.

DEVELOPER FINANCIAL SNAPSHOT:
- Available Balance: $${availableBalance.toFixed(2)}
- Last 7 Days Earnings: $${earn7.toFixed(2)}
- Last 30 Days Earnings: $${earn30.toFixed(2)}
- Daily Earning Velocity: $${dailyVelocity.toFixed(2)}/day
- Total Earned All Time: $${totalEarned.toFixed(2)}
- Total Paid Out: $${totalPaidOut.toFixed(2)}
- Number of Past Payouts: ${payouts.length}

Current day: ${new Date().toDateString()}

Analyze and recommend:
1. Optimal payout timing (day of week, time of month) to minimize PayPal/Stripe fees
2. Minimum balance thresholds to avoid small-transaction fees
3. Currency exchange considerations (USD strongest vs other currencies)
4. Predicted next milestone dates
5. Fee optimization strategy

Return JSON:
{
  "optimal_day_of_week": "string (e.g. Tuesday)",
  "optimal_day_of_month": number,
  "reason": "string",
  "predicted_next_payout_date": "string (ISO date)",
  "predicted_balance_at_payout": number,
  "days_until_optimal_payout": number,
  "minimum_recommended_withdrawal": number,
  "fee_savings_tip": "string",
  "earning_velocity_label": "string (e.g. Accelerating, Steady, Slowing)",
  "velocity_trend_pct": number,
  "projected_monthly_earnings": number,
  "projected_annual_earnings": number,
  "risk_level": "low|medium|high",
  "schedule_recommendation": "string",
  "milestones": [
    { "label": "string", "amount": number, "days_away": number }
  ],
  "tips": ["string"]
}`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          optimal_day_of_week: { type: 'string' },
          optimal_day_of_month: { type: 'number' },
          reason: { type: 'string' },
          predicted_next_payout_date: { type: 'string' },
          predicted_balance_at_payout: { type: 'number' },
          days_until_optimal_payout: { type: 'number' },
          minimum_recommended_withdrawal: { type: 'number' },
          fee_savings_tip: { type: 'string' },
          earning_velocity_label: { type: 'string' },
          velocity_trend_pct: { type: 'number' },
          projected_monthly_earnings: { type: 'number' },
          projected_annual_earnings: { type: 'number' },
          risk_level: { type: 'string' },
          schedule_recommendation: { type: 'string' },
          milestones: { type: 'array', items: { type: 'object' } },
          tips: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    return Response.json({
      success: true,
      analysis,
      metrics: {
        available_balance: availableBalance,
        daily_velocity: dailyVelocity,
        earn_7d: earn7,
        earn_30d: earn30,
        velocity_data: velocityData,
      }
    });
  } catch (error) {
    console.error('aiPayoutScheduler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});