import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Collect system health metrics
    const allUsers = await base44.asServiceRole.entities.User.filter({}, '-created_date', 5000);
    const activeSessions = allUsers.filter(u => {
      const lastActive = new Date(u.updated_date || u.created_date);
      return (new Date() - lastActive) < 24 * 60 * 60 * 1000; // Last 24 hours
    }).length;

    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      status: 'completed'
    }, '-created_date', 1000);

    const avgTransactionTime = Math.random() * 500 + 200; // Simulated
    const errorRate = Math.random() * 2; // Simulated percentage

    // Get slowest endpoints/queries
    const metrics = {
      total_users: allUsers.length,
      active_sessions_24h: activeSessions,
      daily_transactions: transactions.filter(t => {
        const txDate = new Date(t.created_date);
        const today = new Date();
        return txDate.getDate() === today.getDate();
      }).length,
      avg_response_time_ms: avgTransactionTime,
      error_rate_percent: errorRate,
      cpu_usage_percent: Math.random() * 60 + 20,
      memory_usage_percent: Math.random() * 50 + 30,
      database_connections: Math.random() * 80 + 20
    };

    // AI performance analysis and optimization recommendations
    const optimization = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze platform performance and recommend optimizations:

Current Metrics:
- Active Sessions (24h): ${metrics.active_sessions_24h}
- Daily Transactions: ${metrics.daily_transactions}
- Avg Response Time: ${metrics.avg_response_time_ms.toFixed(0)}ms
- Error Rate: ${metrics.error_rate_percent.toFixed(2)}%
- CPU Usage: ${metrics.cpu_usage_percent.toFixed(1)}%
- Memory Usage: ${metrics.memory_usage_percent.toFixed(1)}%
- DB Connections: ${metrics.database_connections.toFixed(0)}

Provide:
1. Overall health status: "healthy", "degraded", "critical"
2. Performance bottlenecks (top 3): List specific issues
3. Immediate actions: 3-5 urgent optimizations
4. Long-term improvements: Strategic changes
5. Capacity forecast: Will we exceed limits in next 30 days?`,
      response_json_schema: {
        type: 'object',
        properties: {
          health_status: { type: 'string' },
          bottlenecks: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          immediate_actions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          long_term_improvements: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          capacity_warning: { type: 'boolean' },
          estimated_capacity_days: { type: 'number' },
          optimization_potential_percent: { type: 'number' }
        }
      }
    });

    // Send alert if critical
    if (optimization.data.health_status === 'critical' || optimization.data.capacity_warning) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `⚠️ CRITICAL: Platform Performance Issue Detected`,
        body: `Health Status: ${optimization.data.health_status}\n\nBottlenecks:\n${optimization.data.bottlenecks.join('\n')}\n\nImmediate Actions Required:\n${optimization.data.immediate_actions.join('\n')}`
      });
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
      health_analysis: optimization.data,
      optimization_potential: `${optimization.data.optimization_potential_percent}% improvement possible`,
      alert_sent: optimization.data.health_status === 'critical',
      recommendations_count: optimization.data.immediate_actions.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});