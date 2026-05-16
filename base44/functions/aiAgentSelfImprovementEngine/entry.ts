import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Analyze all agent performance data
    const agents = [
      'growth_engine_agent', 'platform_automation_superagent', 'universal_user_action_agent',
      'universal_admin_action_agent', 'final_decision_agent', 'monetization_optimizer',
      'fraud_detection', 'churn_predictor', 'support_bot', 'market_analyzer'
    ];

    const improvementRecommendations = [];

    for (const agentName of agents) {
      // Get agent's learning history
      const memories = await base44.asServiceRole.entities.AgentLearningMemory?.filter({
        agent_name: agentName
      }, '-recorded_at', 200) || [];

      if (memories.length === 0) continue;

      // Calculate metrics
      const successCount = memories.filter(m => m.success).length;
      const successRate = (successCount / memories.length * 100);
      const avgFeedbackScore = memories.reduce((sum, m) => sum + (m.feedback_score || 0), 0) / memories.length;
      
      // Identify failure patterns
      const failures = memories.filter(m => !m.success);
      const failurePatterns = {};
      failures.forEach(f => {
        if (f.action_taken) {
          failurePatterns[f.action_taken] = (failurePatterns[f.action_taken] || 0) + 1;
        }
      });

      // Get improvement suggestions from LLM
      const improvement = await base44.integrations.Core.InvokeLLM({
        prompt: `Agent Performance Analysis: "${agentName}"

Success Rate: ${successRate.toFixed(1)}%
Avg Feedback Score: ${avgFeedbackScore.toFixed(2)}/1.0
Total Decisions: ${memories.length}

Top Failure Patterns: ${Object.entries(failurePatterns).slice(0, 3).map(([a, c]) => a + ' (' + c + ')').join(', ')}

Recent User Feedback: ${memories.filter(m => m.user_feedback).map(m => m.user_feedback).slice(0, 3).join(' | ')}

Provide:
1. Performance assessment: "excellent", "good", "needs_improvement", "critical"
2. Root causes: Why is the agent underperforming?
3. Specific improvements: 2-3 concrete changes to the agent's instructions
4. Retraining focus: What should this agent focus on learning?
5. Expected improvement: What % success rate improvement expected?`,
        response_json_schema: {
          type: 'object',
          properties: {
            assessment: { type: 'string' },
            root_causes: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            instruction_improvements: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            retraining_focus: { type: 'string' },
            expected_improvement_percent: { type: 'number' }
          }
        }
      });

      improvementRecommendations.push({
        agent_name: agentName,
        current_success_rate: successRate.toFixed(1),
        feedback_score: avgFeedbackScore.toFixed(2),
        analysis: improvement.data,
        needs_update: successRate < 75,
        priority: successRate < 50 ? 'critical' : successRate < 65 ? 'high' : 'medium'
      });
    }

    // Identify top performers vs underperformers
    const topPerformers = improvementRecommendations.filter(r => r.current_success_rate > 85);
    const needsAttention = improvementRecommendations.filter(r => r.current_success_rate < 65);
    const criticalAgents = improvementRecommendations.filter(r => r.priority === 'critical');

    // Send notifications if critical issues found
    if (criticalAgents.length > 0) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `⚠️ CRITICAL: ${criticalAgents.length} AI Agent(s) Need Immediate Improvement`,
        body: `Critical agents requiring intervention:\n${criticalAgents.map(a => `- ${a.agent_name}: ${a.current_success_rate}% success rate`).join('\n')}`
      });
    }

    return Response.json({
      success: true,
      analysis_timestamp: new Date().toISOString(),
      total_agents_analyzed: improvementRecommendations.length,
      top_performers: topPerformers.length,
      agents_needing_attention: needsAttention.length,
      critical_agents: criticalAgents.length,
      recommendations: improvementRecommendations.sort((a, b) => {
        const priorityMap = { critical: 1, high: 2, medium: 3 };
        return priorityMap[a.priority] - priorityMap[b.priority];
      }),
      system_health: criticalAgents.length === 0 ? 'optimal' : criticalAgents.length < 3 ? 'good' : 'degraded',
      next_review: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});