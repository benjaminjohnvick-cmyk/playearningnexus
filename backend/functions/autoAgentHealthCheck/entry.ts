import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const now = new Date();
    const results = {};

    // 1. Check all agent performance logs for recent failures
    const recentLogs = await base44.asServiceRole.entities.AgentPerformanceLog.list('-run_date', 100);
    const last24h = recentLogs.filter(l => new Date(l.run_date) > new Date(now - 86400000));
    const failedAgents = last24h.filter(l => l.status === 'failed' || l.status === 'error');
    results.agents_checked = last24h.length;
    results.failed_agents = failedAgents.length;

    if (failedAgents.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        if (admin.email) {
          await base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: `⚠️ Agent Health Alert: ${failedAgents.length} Failed Agent(s)`,
            body: `The following AI agents had failures in the last 24 hours:\n\n${failedAgents.map(a => `• ${a.agent_name}: ${a.error_message || 'Unknown error'}`).join('\n')}\n\nPlease review and investigate.`
          });
        }
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'agent_health_alert',
          title: `⚠️ ${failedAgents.length} AI Agent(s) Failed`,
          message: `Agents with issues: ${failedAgents.map(a => a.agent_name).join(', ')}`,
          is_read: false
        });
      }
    }

    // 2. Store agent learning memories — consolidate recent learnings
    const recentMemories = await base44.asServiceRole.entities.AgentLearningMemory.list('-created_date', 50);
    const unprocessed = recentMemories.filter(m => !m.applied && new Date(m.created_date) > new Date(now - 7 * 86400000));
    results.unprocessed_learnings = unprocessed.length;

    if (unprocessed.length >= 5) {
      // AI synthesize learnings into actionable improvements
      const synthesized = await base44.integrations.Core.InvokeLLM({
        prompt: `Synthesize these ${unprocessed.length} AI agent learning memories into top 3 actionable platform improvements:
        ${unprocessed.slice(0, 10).map(m => `- ${m.memory_type}: ${m.content || m.summary}`).join('\n')}
        
        Return: improvements (array of 3 strings, each max 100 chars), priority (high/medium/low).`,
        response_json_schema: {
          type: "object",
          properties: {
            improvements: { type: "array", items: { type: "string" } },
            priority: { type: "string" }
          }
        }
      });

      // Mark learnings as processed
      for (const memory of unprocessed.slice(0, 10)) {
        await base44.asServiceRole.entities.AgentLearningMemory.update(memory.id, { applied: true, applied_at: now.toISOString() });
      }

      results.improvements_synthesized = synthesized.improvements?.length || 0;
      results.improvement_priority = synthesized.priority;
    }

    // 3. Check for orphaned/stuck AI agent tasks
    const agentTasks = await base44.asServiceRole.entities.AIAgentTask.filter({ status: 'in_progress' });
    let stuckTasks = 0;
    for (const task of agentTasks) {
      const ageHours = (now - new Date(task.created_date)) / 3600000;
      if (ageHours > 4) {
        await base44.asServiceRole.entities.AIAgentTask.update(task.id, {
          status: 'failed',
          error_message: `Auto-failed: stuck in progress for ${Math.floor(ageHours)} hours`
        });
        stuckTasks++;
      }
    }
    results.stuck_tasks_resolved = stuckTasks;

    return Response.json({ ok: true, timestamp: now.toISOString(), ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});