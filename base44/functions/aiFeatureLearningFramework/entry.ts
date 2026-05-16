import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {
      feature_name,
      feature_type, // 'prediction', 'recommendation', 'optimization', 'detection', 'generation'
      input_data,
      output_data,
      expected_outcome,
      actual_outcome,
      accuracy_score, // 0-1
      user_satisfaction, // 0-1
      performance_metrics = {}
    } = await req.json();

    if (!feature_name || actual_outcome === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Store learning record for all AI features
    const performanceLog = await base44.asServiceRole.entities.AgentPerformanceLog?.create?.({
      feature_name,
      feature_type,
      input_summary: JSON.stringify(input_data).substring(0, 500),
      output_summary: JSON.stringify(output_data).substring(0, 500),
      expected_outcome,
      actual_outcome,
      accuracy_score: accuracy_score || 0,
      satisfaction_score: user_satisfaction || 0,
      performance_metrics: JSON.stringify(performance_metrics),
      is_successful: accuracy_score ? accuracy_score > 0.7 : (actual_outcome > 0.5),
      logged_at: new Date().toISOString()
    }).catch(() => null);

    // Get recent performance history
    const recentHistory = await base44.asServiceRole.entities.AgentPerformanceLog?.filter({
      feature_name,
      logged_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    }, '-logged_at', 500) || [];

    // Calculate performance trends
    const successCount = recentHistory.filter(h => h.is_successful).length;
    const totalCount = recentHistory.length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100) : 0;
    const avgAccuracy = recentHistory.length > 0 
      ? (recentHistory.reduce((sum, h) => sum + (h.accuracy_score || 0), 0) / recentHistory.length * 100)
      : 0;
    const avgSatisfaction = recentHistory.length > 0
      ? (recentHistory.reduce((sum, h) => sum + (h.satisfaction_score || 0), 0) / recentHistory.length * 100)
      : 0;

    // Identify performance trend
    const recentWeek = recentHistory.slice(0, 35);
    const olderWeek = recentHistory.slice(35, 70);
    const recentSuccess = recentWeek.length > 0 ? (recentWeek.filter(h => h.is_successful).length / recentWeek.length * 100) : 0;
    const olderSuccess = olderWeek.length > 0 ? (olderWeek.filter(h => h.is_successful).length / olderWeek.length * 100) : 0;
    const trend = recentSuccess > olderSuccess ? 'improving' : recentSuccess < olderSuccess ? 'degrading' : 'stable';

    return Response.json({
      success: true,
      feature_name,
      logged_at: new Date().toISOString(),
      performance_snapshot: {
        success_rate: successRate.toFixed(1),
        accuracy: avgAccuracy.toFixed(1),
        user_satisfaction: avgSatisfaction.toFixed(1),
        total_decisions: totalCount,
        trend,
        needs_improvement: successRate < 70
      },
      learning_progress: {
        recent_week_success: recentSuccess.toFixed(1),
        previous_week_success: olderSuccess.toFixed(1),
        improvement_rate: (recentSuccess - olderSuccess).toFixed(1)
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});