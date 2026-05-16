import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get active users with transaction history
    const users = await base44.asServiceRole.entities.User.filter({}, '-created_date', 1000);
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      status: 'completed'
    }, '-created_date', 5000);

    const ltfPredictions = [];
    const segmentMetrics = {};

    for (const userRecord of users) {
      const userTransactions = transactions.filter(t => t.user_id === userRecord.id);
      const userActivity = await base44.asServiceRole.entities.UserActivity.filter({
        user_id: userRecord.id
      }, '-created_date', 100);

      if (userTransactions.length === 0) continue;

      // Calculate user metrics
      const metrics = {
        user_id: userRecord.id,
        total_transactions: userTransactions.length,
        total_spent: userTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        avg_transaction_value: userTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) / userTransactions.length,
        days_active: Math.floor((new Date() - new Date(userRecord.created_date)) / (1000 * 60 * 60 * 24)),
        activity_score: userActivity.length,
        last_transaction: userTransactions[0]?.created_date,
        engagement_frequency: userActivity.length / (Math.floor((new Date() - new Date(userRecord.created_date)) / (1000 * 60 * 60 * 24)) || 1)
      };

      // AI-powered LTV prediction
      const ltfAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Predict customer lifetime value based on these metrics:
- Total spent: $${metrics.total_spent.toFixed(2)}
- Transaction count: ${metrics.total_transactions}
- Avg transaction: $${metrics.avg_transaction_value.toFixed(2)}
- Days active: ${metrics.days_active}
- Activity frequency: ${metrics.engagement_frequency.toFixed(2)} per day
- Last transaction: ${metrics.last_transaction}

Provide:
1. Predicted LTV (12-month): USD amount
2. Growth trajectory: "accelerating", "stable", "declining"
3. Risk category: "high_value", "growth_potential", "at_risk", "churn_likely"
4. Recommended actions: 2-3 specific retention tactics`,
        response_json_schema: {
          type: 'object',
          properties: {
            predicted_ltv_12m: { type: 'number' },
            growth_trajectory: { type: 'string' },
            risk_category: { type: 'string' },
            confidence_score: { type: 'number', minimum: 0, maximum: 100 },
            recommended_actions: { type: 'array', items: { type: 'string' }, maxItems: 3 }
          }
        }
      });

      const prediction = {
        ...metrics,
        ...ltfAnalysis.data,
        prediction_date: new Date().toISOString()
      };

      ltfPredictions.push(prediction);

      // Track segments
      const segment = ltfAnalysis.data.risk_category;
      segmentMetrics[segment] = (segmentMetrics[segment] || 0) + 1;
    }

    // Calculate portfolio stats
    const highValueCount = ltfPredictions.filter(p => p.risk_category === 'high_value').length;
    const growthCount = ltfPredictions.filter(p => p.risk_category === 'growth_potential').length;
    const atRiskCount = ltfPredictions.filter(p => p.risk_category === 'at_risk').length;
    const churnCount = ltfPredictions.filter(p => p.risk_category === 'churn_likely').length;

    const totalProjectedLTV = ltfPredictions.reduce((sum, p) => sum + p.predicted_ltv_12m, 0);
    const avgLTV = totalProjectedLTV / ltfPredictions.length;

    return Response.json({
      success: true,
      analysis_date: new Date().toISOString(),
      total_users_analyzed: ltfPredictions.length,
      portfolio: {
        total_projected_ltv: totalProjectedLTV.toFixed(2),
        avg_ltv: avgLTV.toFixed(2),
        high_value_count: highValueCount,
        growth_potential_count: growthCount,
        at_risk_count: atRiskCount,
        churn_likely_count: churnCount
      },
      segments: segmentMetrics,
      top_ltv_users: ltfPredictions.sort((a, b) => b.predicted_ltv_12m - a.predicted_ltv_12m).slice(0, 10),
      churn_risk_users: ltfPredictions.filter(p => p.risk_category === 'churn_likely').slice(0, 10),
      growth_opportunities: ltfPredictions.filter(p => p.risk_category === 'growth_potential').slice(0, 10)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});