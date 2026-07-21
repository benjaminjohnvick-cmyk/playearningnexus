import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'analyze', survey_id, developer_id } = body;

    if (action === 'analyze') {
      // Fetch UX session recordings for this survey
      const filter = survey_id ? { survey_id, is_survey_session: true } : { is_survey_session: true };
      const sessions = await base44.asServiceRole.entities.UXSessionRecording.filter(filter);

      if (sessions.length === 0) {
        return Response.json({ success: true, message: 'No sessions recorded yet', heatmap: null });
      }

      // Fetch corresponding responses
      const responses = survey_id
        ? await base44.asServiceRole.entities.PPCSurveyResponse.filter({ survey_id })
        : [];

      // Aggregate drop-off points
      const dropOffMap = {};
      const completionTimes = [];
      const tabSwitchCounts = [];
      const fraudFlags = [];

      for (const s of sessions) {
        const duration = s.session_duration_seconds || 0;
        completionTimes.push(duration);
        tabSwitchCounts.push(s.tab_switches || 0);
        if (s.drop_off_point) {
          dropOffMap[s.drop_off_point] = (dropOffMap[s.drop_off_point] || 0) + 1;
        }
        if (s.fraud_score > 60) fraudFlags.push(s.session_id);
      }

      const avgCompletionTime = completionTimes.length
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;
      const avgTabSwitches = tabSwitchCounts.length
        ? tabSwitchCounts.reduce((a, b) => a + b, 0) / tabSwitchCounts.length
        : 0;

      const completedCount = sessions.filter(s => !s.drop_off_point || s.drop_off_point === 'completed').length;
      const completionRate = sessions.length ? (completedCount / sessions.length) * 100 : 0;

      // Build question-level timing heatmap
      const questionTimings = {};
      for (const s of sessions) {
        for (const qt of (s.question_timings || [])) {
          const qi = qt.question_index;
          if (!questionTimings[qi]) questionTimings[qi] = { total_time: 0, count: 0, changed_answer: 0 };
          questionTimings[qi].total_time += qt.time_to_answer_ms || 0;
          questionTimings[qi].count++;
          if (qt.changed_answer) questionTimings[qi].changed_answer++;
        }
      }

      const questionHeatmap = Object.entries(questionTimings).map(([idx, data]) => ({
        question_index: Number(idx),
        avg_time_seconds: Math.round(data.total_time / data.count / 1000),
        response_count: data.count,
        confusion_rate: Math.round((data.changed_answer / data.count) * 100),
      })).sort((a, b) => a.question_index - b.question_index);

      // AI analysis
      const prompt = `You are a UX research expert analyzing survey session data to help developers improve completion rates.

Survey Stats:
- Total sessions: ${sessions.length}
- Completion rate: ${completionRate.toFixed(1)}%
- Avg completion time: ${Math.round(avgCompletionTime)}s
- Avg tab switches (distraction signal): ${avgTabSwitches.toFixed(1)}
- Drop-off points: ${JSON.stringify(dropOffMap)}
- Suspicious sessions: ${fraudFlags.length}
- Question confusion heatmap: ${JSON.stringify(questionHeatmap)}

Identify where users struggle, drop off, or lose interest. Provide specific, actionable recommendations.

Respond in JSON:
{
  "overall_ux_score": number (0-100),
  "critical_issues": string[],
  "drop_off_analysis": string,
  "high_confusion_questions": number[],
  "recommendations": [
    { "priority": "high"|"medium"|"low", "issue": string, "fix": string, "estimated_impact": string }
  ],
  "engagement_insight": string,
  "predicted_completion_boost": string
}`;

      const aiInsights = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_ux_score: { type: 'number' },
            critical_issues: { type: 'array', items: { type: 'string' } },
            drop_off_analysis: { type: 'string' },
            high_confusion_questions: { type: 'array', items: { type: 'number' } },
            recommendations: { type: 'array', items: { type: 'object' } },
            engagement_insight: { type: 'string' },
            predicted_completion_boost: { type: 'string' }
          }
        }
      });

      // Save heatmap analysis
      await base44.asServiceRole.entities.SurveyHeatmapData.create({
        survey_id: survey_id || 'all',
        developer_id: developer_id || user.id,
        session_count: sessions.length,
        completion_rate: completionRate,
        avg_completion_time_seconds: avgCompletionTime,
        question_heatmap: questionHeatmap,
        drop_off_points: dropOffMap,
        ai_insights: aiInsights,
        analyzed_at: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        stats: {
          total_sessions: sessions.length,
          completion_rate: completionRate,
          avg_completion_time_seconds: avgCompletionTime,
          avg_tab_switches: avgTabSwitches,
          suspicious_sessions: fraudFlags.length,
        },
        drop_off_points: dropOffMap,
        question_heatmap: questionHeatmap,
        ai_insights: aiInsights,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});