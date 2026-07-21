import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { user_ids } = await req.json();

    // Get at-risk users
    const atRiskUsers = await base44.asServiceRole.entities.User.filter({
      id: { $in: user_ids || [] }
    }, '-created_date', 100);

    const retentionStrategies = [];

    for (const userRecord of atRiskUsers) {
      const userActivity = await base44.asServiceRole.entities.UserActivity.filter({
        user_id: userRecord.id
      }, '-created_date', 50);

      const transactions = await base44.asServiceRole.entities.Transaction.filter({
        user_id: userRecord.id,
        status: 'completed'
      }, '-created_date', 20);

      const inactivityDays = Math.floor((new Date() - new Date(userRecord.updated_date || userRecord.created_date)) / (1000 * 60 * 60 * 24));
      const lastTransactionDays = transactions.length > 0 ? Math.floor((new Date() - new Date(transactions[0].created_date)) / (1000 * 60 * 60 * 24)) : 999;

      // Generate personalized retention strategy
      const strategy = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a personalized retention strategy for a user with:
- Inactivity: ${inactivityDays} days
- Days since last purchase: ${lastTransactionDays} days
- Total lifetime value: $${transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}
- Transaction frequency: ${transactions.length} transactions
- Recent activity level: ${userActivity.length} events in last 50

Provide:
1. Engagement risk level: "critical", "high", "moderate"
2. Recommended incentive: Specific discount/offer
3. Communication channel: "email", "push", "sms"
4. Best time to reach out: Day of week + hour
5. Expected re-engagement rate: percentage`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_level: { type: 'string' },
            recommended_incentive: { type: 'string' },
            incentive_value: { type: 'number' },
            communication_channel: { type: 'string' },
            optimal_contact_time: { type: 'string' },
            expected_re_engagement_rate: { type: 'number' },
            message_template: { type: 'string' }
          }
        }
      });

      retentionStrategies.push({
        user_id: userRecord.id,
        user_email: userRecord.email,
        user_name: userRecord.full_name,
        metrics: {
          inactivity_days: inactivityDays,
          days_since_purchase: lastTransactionDays,
          lifetime_value: transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2),
          engagement_score: Math.max(0, 100 - (inactivityDays * 2))
        },
        strategy: strategy.data,
        action_priority: strategy.data.risk_level === 'critical' ? 1 : strategy.data.risk_level === 'high' ? 2 : 3
      });
    }

    // AI aggregate insights
    const aggregateInsight = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze retention needs for ${retentionStrategies.length} at-risk users. Risk distribution: ${retentionStrategies.filter(s => s.strategy.risk_level === 'critical').length} critical, ${retentionStrategies.filter(s => s.strategy.risk_level === 'high').length} high, ${retentionStrategies.filter(s => s.strategy.risk_level === 'moderate').length} moderate.

Provide:
1. Overall retention campaign focus
2. Budget allocation suggestion across risk levels
3. Expected recovery rate
4. Timeline for expected results`,
      response_json_schema: {
        type: 'object',
        properties: {
          campaign_focus: { type: 'string' },
          budget_allocation: { type: 'object' },
          expected_recovery_rate: { type: 'number' },
          roi_projection: { type: 'string' },
          timeline_weeks: { type: 'number' }
        }
      }
    });

    return Response.json({
      success: true,
      analysis_date: new Date().toISOString(),
      total_at_risk: retentionStrategies.length,
      risk_distribution: {
        critical: retentionStrategies.filter(s => s.strategy.risk_level === 'critical').length,
        high: retentionStrategies.filter(s => s.strategy.risk_level === 'high').length,
        moderate: retentionStrategies.filter(s => s.strategy.risk_level === 'moderate').length
      },
      user_strategies: retentionStrategies.sort((a, b) => a.action_priority - b.action_priority),
      campaign_insights: aggregateInsight.data
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});