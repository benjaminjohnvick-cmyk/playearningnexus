import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Weekly: analyze AgentPerformanceLog, generate learnings, update AgentLearningMemory
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const logs = await base44.asServiceRole.entities.AgentPerformanceLog.list('-created_date', 100);
    const recentLogs = logs.filter(l => l.created_date >= sevenDaysAgo);

    if (recentLogs.length === 0) return Response.json({ ok: true, message: 'No recent logs' });

    // Group by agent
    const byAgent = {};
    for (const log of recentLogs) {
      if (!byAgent[log.agent_name]) byAgent[log.agent_name] = [];
      byAgent[log.agent_name].push(log);
    }

    const results = [];
    for (const [agentName, agentLogs] of Object.entries(byAgent)) {
      const avgSuccessRate = agentLogs.filter(l => l.success).length / agentLogs.length;
      const avgDuration = agentLogs.reduce((s, l) => s + (l.duration_ms || 0), 0) / agentLogs.length;
      const errors = agentLogs.filter(l => !l.success).map(l => l.error_message).filter(Boolean);

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze AI agent performance for the past 7 days:
Agent: ${agentName}
Success rate: ${(avgSuccessRate * 100).toFixed(1)}%
Avg duration: ${Math.round(avgDuration)}ms
Total runs: ${agentLogs.length}
Common errors: ${errors.slice(0, 5).join('; ')}

Generate: key_learnings (array of 3 insights), improvement_suggestions (array of 2 action items), performance_grade (A/B/C/D/F)`,
        response_json_schema: {
          type: 'object',
          properties: {
            key_learnings: { type: 'array', items: { type: 'string' } },
            improvement_suggestions: { type: 'array', items: { type: 'string' } },
            performance_grade: { type: 'string' }
          }
        }
      });

      // Save to AgentLearningMemory
      for (const learning of analysis.key_learnings || []) {
        await base44.asServiceRole.entities.AgentLearningMemory.create({
          agent_name: agentName,
          memory_type: 'learned_pattern',
          content: learning,
          recommended_action: analysis.improvement_suggestions?.[0] || 'Review and optimize',
          approval_rate_at_creation: avgSuccessRate,
          accuracy_rate_at_creation: avgSuccessRate
        });
      }

      results.push({ agent: agentName, grade: analysis.performance_grade, success_rate: avgSuccessRate });
    }

    // Alert admins on poor performance
    const poorAgents = results.filter(r => ['D', 'F'].includes(r.performance_grade));
    if (poorAgents.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 1)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'agent_performance_alert',
          title: `🤖 Agent Performance Alert: ${poorAgents.length} Underperforming`,
          message: `Agents needing attention: ${poorAgents.map(a => `${a.agent} (${a.performance_grade})`).join(', ')}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, agents_analyzed: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});