import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get UX session data
    const sessions = await base44.asServiceRole.entities.UXSessionRecording?.filter({}, '-recorded_at', 500) || [];
    
    const dropOffAnalysis = {};
    const conversionFunnels = {};
    
    sessions.forEach(session => {
      const funnel = session.conversion_funnel?.[session.conversion_funnel.length - 1] || 'unknown';
      const dropoff = session.drop_off_point || 'completion';
      
      conversionFunnels[funnel] = (conversionFunnels[funnel] || 0) + 1;
      dropOffAnalysis[dropoff] = (dropOffAnalysis[dropoff] || 0) + 1;
    });

    // Identify friction points
    const frictionPoints = Object.entries(dropOffAnalysis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([point, count]) => ({ point, frequency: count }));

    const uxAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze UX friction points and optimize user experience:

Drop-off Analysis:
${frictionPoints.map(f => `- ${f.point}: ${f.frequency} sessions`).join('\n')}

Total Sessions Analyzed: ${sessions.length}
Session Issues: ${sessions.filter(s => s.issue_tags?.length > 0).length}
Common Issues: ${sessions.flatMap(s => s.issue_tags || []).slice(0, 5).join(', ')}

Provide:
1. Top 3 UX friction points: Specific areas causing drop-offs
2. Root causes: Why users are leaving
3. Quick wins: Easy fixes for immediate improvement
4. Redesign recommendations: Major UX improvements
5. Measurement plan: How to track improvements`,
      response_json_schema: {
        type: 'object',
        properties: {
          friction_points: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          root_causes: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          quick_wins: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          redesign_priorities: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          expected_conversion_lift_percent: { type: 'number' }
        }
      }
    });

    const uxData = uxAnalysis?.data || {};
    return Response.json({
      success: true,
      analysis_date: new Date().toISOString(),
      sessions_analyzed: sessions.length,
      friction_analysis: frictionPoints,
      ux_recommendations: uxData,
      expected_impact: uxData.expected_conversion_lift_percent != null
        ? `${uxData.expected_conversion_lift_percent}% conversion increase potential`
        : 'Impact pending analysis',
      priority_actions: uxData.quick_wins || []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});