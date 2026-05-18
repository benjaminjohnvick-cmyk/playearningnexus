import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get all AI feature performance data
    const allFeatures = await base44.asServiceRole.entities.AgentPerformanceLog?.filter({}, '-logged_at', 5000) || [];

    // Group by feature type
    const featureGroups = {};
    allFeatures.forEach(log => {
      const key = log.feature_name;
      if (!featureGroups[key]) {
        featureGroups[key] = [];
      }
      featureGroups[key].push(log);
    });

    const optimizations = [];

    // Analyze each feature
    for (const [featureName, history] of Object.entries(featureGroups)) {
      if (history.length < 10) continue; // Need minimum data

      // Calculate metrics
      const successCount = history.filter(h => h.is_successful).length;
      const successRate = (successCount / history.length * 100);
      const avgAccuracy = history.reduce((sum, h) => sum + (h.accuracy_score || 0), 0) / history.length;
      const avgSatisfaction = history.reduce((sum, h) => sum + (h.satisfaction_score || 0), 0) / history.length;

      // Get failure patterns
      const failures = history.filter(h => !h.is_successful);
      const failurePatterns = {};
      failures.slice(0, 20).forEach(f => {
        const input = f.input_summary || '';
        const pattern = input.substring(0, 50);
        failurePatterns[pattern] = (failurePatterns[pattern] || 0) + 1;
      });

      // Get optimization suggestions
      if (successRate < 80 || avgAccuracy < 0.75) {
        const optimization = await base44.integrations.Core.InvokeLLM({
          prompt: `Optimize AI feature performance: "${featureName}"

Performance Data:
- Success Rate: ${successRate.toFixed(1)}%
- Accuracy: ${(avgAccuracy * 100).toFixed(1)}%
- User Satisfaction: ${(avgSatisfaction * 100).toFixed(1)}%
- Total Decisions: ${history.length}

Top Failure Pattern: ${Object.entries(failurePatterns).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'}

Provide:
1. Root cause of underperformance
2. Specific parameter adjustments (e.g., "increase threshold from 0.7 to 0.8")
3. Data quality improvements needed
4. Expected improvement % after fixes`,
          response_json_schema: {
            type: 'object',
            properties: {
              root_cause: { type: 'string' },
              parameter_adjustments: { type: 'array', items: { type: 'string' }, maxItems: 3 },
              data_improvements: { type: 'array', items: { type: 'string' }, maxItems: 2 },
              expected_improvement_percent: { type: 'number' }
            }
          }
        });

        optimizations.push({
          feature_name: featureName,
          current_performance: {
            success_rate: successRate.toFixed(1),
            accuracy: (avgAccuracy * 100).toFixed(1),
            satisfaction: (avgSatisfaction * 100).toFixed(1)
          },
          optimization: optimization.data,
          priority: successRate < 60 ? 'critical' : successRate < 70 ? 'high' : 'medium',
          decision_count: history.length,
          expected_new_rate: (successRate + (optimization.data?.expected_improvement_percent || 0)).toFixed(1)
        });
      }
    }

    // Sort by priority and impact
    optimizations.sort((a, b) => {
      const priorityMap = { critical: 1, high: 2, medium: 3 };
      const aDiff = priorityMap[a.priority];
      const bDiff = priorityMap[b.priority];
      return aDiff - bDiff;
    });

    // Send critical alerts
    const critical = optimizations.filter(o => o.priority === 'critical');
    if (critical.length > 0) {
      await base44.integrations.Core.SendEmail({
        to: 'admin@gamergain.com',
        subject: `🚨 CRITICAL: ${critical.length} AI Feature(s) Need Optimization`,
        body: `Critical AI features requiring immediate optimization:\n${critical.map(c => `\n${c.feature_name}:\n- Current: ${c.current_performance.success_rate}% success\n- Issue: ${c.optimization.root_cause}\n- Expected Improvement: +${c.optimization.expected_improvement_percent}%`).join('\n')}`
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      analysis_timestamp: new Date().toISOString(),
      total_features_analyzed: Object.keys(featureGroups).length,
      features_needing_optimization: optimizations.length,
      critical_count: critical.length,
      optimizations: optimizations.slice(0, 20), // Top 20 by priority
      system_health: critical.length === 0 ? 'excellent' : critical.length < 3 ? 'good' : 'needs_attention',
      projected_improvement: optimizations.length > 0 
        ? (optimizations.reduce((sum, o) => sum + (o.optimization?.expected_improvement_percent || 0), 0) / optimizations.length).toFixed(1)
        : 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});