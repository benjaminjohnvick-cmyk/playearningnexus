import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: agent performance evaluation, learning memory updates, self-improvement, orchestration health
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];
  const now = new Date().toISOString();

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Evaluate all agent performance
  await invoke('evaluateAgentPerformance');
  results.agent_performance_evaluated = true;

  // 2. AI agent learning system
  await invoke('aiAgentLearningSystem');
  results.agent_learning_updated = true;

  // 3. Agent self-improvement engine
  await invoke('aiAgentSelfImprovementEngine');
  results.agent_self_improvement_run = true;

  // 4. Auto learning orchestrator
  await invoke('aiAutoLearningOrchestrator');
  results.learning_orchestration_run = true;

  // 5. AI orchestrator health check
  await invoke('aiOrchestrator');
  results.orchestrator_run = true;

  // 6. Master orchestrator cycle
  await invoke('masterOrchestrator');
  results.master_orchestrator_run = true;

  // 7. Log performance for all recent agent runs
  try {
    const recentLogs = await base44.asServiceRole.entities.AgentPerformanceLog.list('-created_date', 20);
    const successRate = recentLogs.length > 0
      ? recentLogs.filter(l => l.status === 'success').length / recentLogs.length * 100
      : 100;

    results.agent_success_rate = `${successRate.toFixed(1)}%`;
    results.recent_agent_logs = recentLogs.length;

    // 8. Alert if success rate drops below 70%
    if (successRate < 70) {
      try {
        await base44.asServiceRole.entities.AdminAuditLog.create({
          action: 'agent_health_alert',
          description: `Agent success rate dropped to ${successRate.toFixed(1)}% - investigation needed`,
          entity_type: 'system',
          performed_by: 'autoAgentHealthMonitor'
        });
        results.health_alert_created = true;
      } catch (e) {
        errors.push({ fn: 'AdminAuditLog.create', error: e.message });
      }
    }
  } catch (e) {
    errors.push({ fn: 'AgentPerformanceLog.list', error: e.message });
  }

  // 9. Update learning memories based on recent performance
  try {
    const learningMemories = await base44.asServiceRole.entities.AgentLearningMemory.list('-created_date', 10);
    results.learning_memories = learningMemories.length;
  } catch (e) {
    errors.push({ fn: 'AgentLearningMemory.list', error: e.message });
  }

  // 10. AI survey UX learning engine
  await invoke('aiSurveyUXLearningEngine');
  results.survey_ux_learning_run = true;

  // 11. User experience optimizer
  await invoke('aiUserExperienceOptimizer');
  results.ux_optimizer_run = true;

  return Response.json({ success: true, results, errors });
});