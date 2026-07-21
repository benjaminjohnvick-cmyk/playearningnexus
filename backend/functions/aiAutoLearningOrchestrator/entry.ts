import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Master orchestration of ALL AI learning systems
    const timestamp = new Date().toISOString();

    // 1. Collect all performance data across all AI features
    const allPerformanceLogs = await base44.asServiceRole.entities.AgentPerformanceLog?.filter({
      logged_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    }, '-logged_at', 10000) || [];

    // 2. Run optimization engine for features below threshold
    let optimizationResult = { data: { optimizations: [], critical_count: 0, total_features_analyzed: 0, system_health: 'unknown' } };
    try {
      optimizationResult = await base44.functions.invoke('aiUniversalOptimizationEngine', {});
    } catch {
      // Optimization engine not available, continue with defaults
    }

    // 3. Aggregate learning across agents
    const agentLearning = await base44.asServiceRole.entities.AgentLearningMemory?.filter({
      recorded_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    }, '-recorded_at', 5000) || [];

    // 4. Calculate cross-system patterns
    const systemPatterns = {};
    allPerformanceLogs.forEach(log => {
      const key = `${log.feature_type}_success`;
      systemPatterns[key] = (systemPatterns[key] || 0) + (log.is_successful ? 1 : 0);
    });

    const systemInsights = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze platform-wide AI learning trends:

    Performance Summary (Last 7 days):
    - Total Decisions: ${allPerformanceLogs.length}
    - Total Learning Events: ${agentLearning.length}
    - Features Optimized: ${(optimizationResult.data?.optimizations || []).length}
    - Critical Issues: ${optimizationResult.data?.critical_count || 0}

Success Rates by Type:
${Object.entries(systemPatterns).map(([type, count]) => `- ${type}: ${count} successes`).join('\n')}

Provide:
1. Overall AI system health assessment
2. Cross-feature patterns or dependencies
3. System-wide improvements that could help multiple features
4. Prediction: Will system reach 90%+ performance in 30 days?
5. Resource allocation: Which features need most attention?`,
      response_json_schema: {
        type: 'object',
        properties: {
          health_assessment: { type: 'string' },
          cross_feature_patterns: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          system_improvements: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          projected_performance_90_days: { type: 'number' },
          resource_priorities: { type: 'array', items: { type: 'string' }, maxItems: 3 }
        }
      }
    });

    // 5. Log orchestration results
    const optimizations = optimizationResult.data?.optimizations || [];
    const criticalCount = optimizationResult.data?.critical_count || 0;
    const systemInsightsData = systemInsights?.data || {};
    const orchestrationLog = {
      timestamp,
      performance_logs_analyzed: allPerformanceLogs.length,
      features_analyzed: optimizationResult.data?.total_features_analyzed || 0,
      optimizations_identified: optimizations.length,
      critical_issues: criticalCount,
      system_insights: systemInsightsData,
      action_items: [
        ...optimizations.slice(0, 5).map(o => ({
          feature: o.feature_name,
          action: 'optimize',
          priority: o.priority,
          expected_gain: o.optimization?.expected_improvement_percent || 0
        })),
        ...(criticalCount > 0 ? [{
          action: 'escalate_to_admin',
          reason: 'critical_features_degraded',
          count: criticalCount
        }] : [])
      ]
    };

    // 6. Store orchestration report
    await base44.asServiceRole.entities.AIEarningsMonitor?.create?.({
      analysis_date: timestamp,
      report_type: 'orchestration',
      data: JSON.stringify(orchestrationLog)
    }).catch(() => null);

    return Response.json({
      success: true,
      orchestration_timestamp: timestamp,
      platform_status: {
        total_features_active: optimizationResult.data?.total_features_analyzed || 0,
        system_health: optimizationResult.data?.system_health || 'unknown',
        learning_events_7d: agentLearning.length,
        decisions_made_7d: allPerformanceLogs.length
      },
      learning_summary: {
        features_improving: allPerformanceLogs.filter(l => l.trend === 'improving').length,
        features_stable: allPerformanceLogs.filter(l => l.trend === 'stable').length,
        features_degrading: allPerformanceLogs.filter(l => l.trend === 'degrading').length
      },
      system_insights: systemInsightsData,
      critical_actions: orchestrationLog.action_items.filter(a => a.priority === 'critical' || a.action === 'escalate_to_admin'),
      projected_system_performance_90d: `${systemInsightsData?.projected_performance_90_days || 0}%`,
      next_orchestration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});