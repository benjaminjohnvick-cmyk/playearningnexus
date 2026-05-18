import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: agent performance evaluation, learning memory updates, self-improvement, orchestration health
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();

    // 1. Evaluate all agent performance
    await base44.asServiceRole.functions.invoke('evaluateAgentPerformance', {});
    results.agent_performance_evaluated = true;

    // 2. AI agent learning system
    await base44.asServiceRole.functions.invoke('aiAgentLearningSystem', {});
    results.agent_learning_updated = true;

    // 3. Agent self-improvement engine
    await base44.asServiceRole.functions.invoke('aiAgentSelfImprovementEngine', {});
    results.agent_self_improvement_run = true;

    // 4. Auto learning orchestrator
    await base44.asServiceRole.functions.invoke('aiAutoLearningOrchestrator', {});
    results.learning_orchestration_run = true;

    // 5. AI orchestrator health check
    await base44.asServiceRole.functions.invoke('aiOrchestrator', {});
    results.orchestrator_run = true;

    // 6. Master orchestrator cycle
    await base44.asServiceRole.functions.invoke('masterOrchestrator', {});
    results.master_orchestrator_run = true;

    // 7. Log performance for all recent agent runs
    const recentLogs = await base44.asServiceRole.entities.AgentPerformanceLog.list('-created_date', 20);
    const successRate = recentLogs.length > 0 
      ? recentLogs.filter(l => l.status === 'success').length / recentLogs.length * 100
      : 100;

    results.agent_success_rate = `${successRate.toFixed(1)}%`;
    results.recent_agent_logs = recentLogs.length;

    // 8. Update learning memories based on recent performance
    const learningMemories = await base44.asServiceRole.entities.AgentLearningMemory.list('-created_date', 10);
    results.learning_memories = learningMemories.length;

    // 9. Alert if success rate drops below 70%
    if (successRate < 70) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        action: 'agent_health_alert',
        description: `Agent success rate dropped to ${successRate.toFixed(1)}% - investigation needed`,
        severity: 'high',
        created_at: now
      });
      results.health_alert_created = true;
    }

    // 10. AI survey UX learning engine
    await base44.asServiceRole.functions.invoke('aiSurveyUXLearningEngine', {});
    results.survey_ux_learning_run = true;

    // 11. User experience optimizer
    await base44.asServiceRole.functions.invoke('aiUserExperienceOptimizer', {});
    results.ux_optimizer_run = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});