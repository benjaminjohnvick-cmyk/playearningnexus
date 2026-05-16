import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Get all survey UX session recordings from past 7 days
    const surveyUXSessions = await base44.asServiceRole.entities.UXSessionRecording?.filter({
      is_survey_session: true,
      recorded_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    }, '-recorded_at', 1000) || [];

    if (surveyUXSessions.length === 0) {
      return Response.json({ success: true, sessions_analyzed: 0, message: 'No new survey sessions' });
    }

    // Analyze patterns across sessions
    const analysisMetrics = {
      total_sessions: surveyUXSessions.length,
      avg_completion_rate: 0,
      avg_drop_off_position: {},
      common_friction_points: {},
      mouse_anomalies: surveyUXSessions.filter(s => s.mouse_patterns?.erratic_movements).length,
      copy_paste_detected: surveyUXSessions.filter(s => s.copy_paste_detected).length,
      avg_session_duration: 0,
      abandoned_sessions: surveyUXSessions.filter(s => !s.conversion_funnel?.includes('completion')).length
    };

    // Aggregate issue patterns
    surveyUXSessions.forEach(session => {
      if (session.issue_tags) {
        session.issue_tags.forEach(tag => {
          analysisMetrics.common_friction_points[tag] = (analysisMetrics.common_friction_points[tag] || 0) + 1;
        });
      }
      if (session.drop_off_point) {
        analysisMetrics.avg_drop_off_position[session.drop_off_point] = 
          (analysisMetrics.avg_drop_off_position[session.drop_off_point] || 0) + 1;
      }
      analysisMetrics.avg_session_duration += session.session_duration_seconds || 0;
    });

    analysisMetrics.avg_session_duration = Math.round(analysisMetrics.avg_session_duration / surveyUXSessions.length);
    analysisMetrics.avg_completion_rate = ((surveyUXSessions.length - analysisMetrics.abandoned_sessions) / surveyUXSessions.length * 100).toFixed(1);

    // AI analysis of UX patterns to improve all features
    const improvements = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze survey UX session recordings to improve platform features:

UX Data (${surveyUXSessions.length} sessions over 7 days):
- Completion Rate: ${analysisMetrics.avg_completion_rate}%
- Avg Session Duration: ${analysisMetrics.avg_session_duration}s
- Abandoned Sessions: ${analysisMetrics.abandoned_sessions}
- Common Friction Points: ${Object.entries(analysisMetrics.common_friction_points).map(([k,v]) => k + ' (' + v + ')').join(', ')}
- Top Drop-off Points: ${Object.entries(analysisMetrics.avg_drop_off_position).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k).join(', ')}
- Fraud Signals Detected: Copy-paste=${analysisMetrics.copy_paste_detected}, Erratic mouse=${analysisMetrics.mouse_anomalies}

Provide recommendations to improve:
1. Survey completion rate (specific UX fixes)
2. Fraud detection (based on observed patterns)
3. Feature improvements across entire platform (beyond surveys)
4. Data quality (based on response patterns)
5. User satisfaction (based on session behavior)`,
      response_json_schema: {
        type: 'object',
        properties: {
          completion_improvements: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          fraud_detection_enhancements: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          platform_feature_improvements: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          data_quality_fixes: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          expected_completion_lift_percent: { type: 'number' }
        }
      }
    });

    // Store analysis for feature improvement
    const uxAnalysisLog = await base44.asServiceRole.entities.AIEarningsMonitor?.create?.({
      analysis_date: new Date().toISOString(),
      report_type: 'survey_ux_analysis',
      data: JSON.stringify({
        metrics: analysisMetrics,
        improvements: improvements.data,
        sessions_analyzed: surveyUXSessions.length
      })
    }).catch(() => null);

    // Log each improvement as a feature enhancement opportunity
    const improvements_to_implement = [
      ...improvements.data.completion_improvements.map(imp => ({ type: 'survey_ux', improvement: imp, priority: 'high' })),
      ...improvements.data.platform_feature_improvements.map(imp => ({ type: 'platform', improvement: imp, priority: 'medium' })),
      ...improvements.data.fraud_detection_enhancements.map(imp => ({ type: 'fraud', improvement: imp, priority: 'high' }))
    ];

    return Response.json({
      success: true,
      analysis_timestamp: new Date().toISOString(),
      sessions_analyzed: surveyUXSessions.length,
      ux_metrics: analysisMetrics,
      ai_improvements: improvements.data,
      improvement_implementations: improvements_to_implement,
      expected_impact: `+${improvements.data.expected_completion_lift_percent}% completion rate improvement`,
      implementations_ready: improvements_to_implement.length,
      next_analysis: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});