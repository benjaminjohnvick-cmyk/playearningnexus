import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get historical transaction data by date
    const allTransactions = await base44.asServiceRole.entities.Transaction.filter({
      status: 'completed'
    }, '-created_date', 10000);

    // Build historical revenue by week
    const revenueByWeek = {};
    allTransactions.forEach(t => {
      const date = new Date(t.created_date);
      const week = Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7));
      revenueByWeek[week] = (revenueByWeek[week] || 0) + (t.amount || 0);
    });

    const historicalData = Object.entries(revenueByWeek)
      .sort(([a], [b]) => a - b)
      .slice(-12)
      .map(([week, revenue]) => ({
        week: parseInt(week),
        revenue: parseFloat(revenue.toFixed(2))
      }));

    // Get active users count trend
    const users = await base44.asServiceRole.entities.User.filter({}, '-created_date', 5000);
    const userCountByWeek = {};
    users.forEach(u => {
      const date = new Date(u.created_date);
      const week = Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7));
      userCountByWeek[week] = (userCountByWeek[week] || 0) + 1;
    });

    const userTrend = Object.entries(userCountByWeek)
      .sort(([a], [b]) => a - b)
      .slice(-12)
      .map(([week, count]) => ({
        week: parseInt(week),
        new_users: count
      }));

    // AI forecast using historical patterns
    const forecast = await base44.integrations.Core.InvokeLLM({
      prompt: `Based on this historical revenue data (last 12 weeks): ${JSON.stringify(historicalData.map(d => d.revenue))}, forecast:
1. Next 4 weeks revenue trend (week by week)
2. Month-over-month growth rate
3. Seasonality patterns detected
4. Risk factors and opportunities
5. Recommended strategies to increase revenue`,
      response_json_schema: {
        type: 'object',
        properties: {
          forecast_next_4_weeks: { type: 'array', items: { type: 'number' }, maxItems: 4 },
          mom_growth_rate: { type: 'number' },
          seasonality_detected: { type: 'string' },
          revenue_momentum: { type: 'string' },
          confidence_score: { type: 'number', minimum: 0, maximum: 100 },
          risk_factors: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          opportunities: { type: 'array', items: { type: 'string' }, maxItems: 3 }
        }
      }
    });

    const currentWeekRevenue = historicalData[historicalData.length - 1]?.revenue || 0;
    const projectedMonthlyRevenue = forecast.data.forecast_next_4_weeks.reduce((a, b) => a + b, 0);

    return Response.json({
      success: true,
      forecast_date: new Date().toISOString(),
      historical: {
        last_12_weeks: historicalData,
        current_week_revenue: currentWeekRevenue,
        avg_weekly_revenue: (historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length).toFixed(2),
        user_growth_trend: userTrend
      },
      forecast: {
        next_4_weeks: forecast.data.forecast_next_4_weeks,
        projected_monthly_revenue: projectedMonthlyRevenue.toFixed(2),
        mom_growth_rate: `${forecast.data.mom_growth_rate.toFixed(1)}%`,
        growth_direction: forecast.data.revenue_momentum,
        confidence: forecast.data.confidence_score
      },
      insights: {
        seasonality: forecast.data.seasonality_detected,
        risk_factors: forecast.data.risk_factors,
        opportunities: forecast.data.opportunities,
        recommended_strategies: forecast.data.opportunities
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});