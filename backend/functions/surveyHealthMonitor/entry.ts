import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Survey Health Monitor — Admin Alert System
 * Scans all active surveys for:
 * 1. Rejection rate spikes (vs 7-day rolling baseline)
 * 2. Completion time deviations (> 2x or < 0.4x target)
 * Creates Notification records for admins and logs AgentPerformanceLog entries.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both admin-triggered and scheduled (no user context)
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [surveys, allResponses, admins] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }),
      base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 2000),
      base44.asServiceRole.entities.User.filter({ role: 'admin' }),
    ]);

    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const alerts = [];

    for (const survey of surveys) {
      const surveyResponses = allResponses.filter(r => r.survey_id === survey.id);
      if (surveyResponses.length < 5) continue; // not enough data

      const recent = surveyResponses.filter(r => r.created_date >= oneDayAgo);
      const baseline = surveyResponses.filter(r => r.created_date >= sevenDaysAgo && r.created_date < oneDayAgo);

      if (recent.length < 3) continue;

      // --- Rejection rate spike ---
      const recentRejectionRate = recent.filter(r => r.is_blocked || r.is_flagged).length / recent.length;
      const baselineRejectionRate = baseline.length > 0
        ? baseline.filter(r => r.is_blocked || r.is_flagged).length / baseline.length
        : 0.1;

      if (recentRejectionRate > baselineRejectionRate * 2.0 && recentRejectionRate > 0.25) {
        alerts.push({
          survey_id: survey.id,
          survey_title: survey.title,
          type: 'rejection_spike',
          severity: recentRejectionRate > 0.5 ? 'critical' : 'high',
          message: `Rejection rate spiked to ${Math.round(recentRejectionRate * 100)}% (baseline: ${Math.round(baselineRejectionRate * 100)}%) in the last 24h`,
          metric_current: Math.round(recentRejectionRate * 100),
          metric_baseline: Math.round(baselineRejectionRate * 100),
        });
      }

      // --- Completion time deviation ---
      const recentWithTime = recent.filter(r => r.time_taken_seconds > 0);
      if (recentWithTime.length >= 2) {
        const avgRecentTime = recentWithTime.reduce((s, r) => s + r.time_taken_seconds, 0) / recentWithTime.length;
        const baselineWithTime = baseline.filter(r => r.time_taken_seconds > 0);
        const avgBaselineTime = baselineWithTime.length > 0
          ? baselineWithTime.reduce((s, r) => s + r.time_taken_seconds, 0) / baselineWithTime.length
          : survey.estimated_time_minutes ? survey.estimated_time_minutes * 60 : 120;

        const ratio = avgRecentTime / avgBaselineTime;
        if (ratio > 2.2 || ratio < 0.35) {
          alerts.push({
            survey_id: survey.id,
            survey_title: survey.title,
            type: 'completion_time_deviation',
            severity: 'medium',
            message: `Avg completion time is ${Math.round(avgRecentTime / 60 * 10) / 10}min vs baseline ${Math.round(avgBaselineTime / 60 * 10) / 10}min (${ratio > 1 ? 'unusually slow' : 'suspiciously fast'})`,
            metric_current: Math.round(avgRecentTime),
            metric_baseline: Math.round(avgBaselineTime),
          });
        }
      }
    }

    // Create admin notifications for each alert
    let notificationsSent = 0;
    for (const alert of alerts) {
      // Notify all admins
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'status_changed',
          title: alert.severity === 'critical'
            ? `🚨 CRITICAL: Survey Alert — ${alert.survey_title}`
            : `⚠️ Survey Alert — ${alert.survey_title}`,
          message: alert.message,
          status: 'unread',
          delivery_method: ['in_app'],
          related_item_id: alert.survey_id,
          action_url: '/AdvancedInsights',
          icon: alert.type === 'rejection_spike' ? 'alert-circle' : 'clock',
        });
        notificationsSent++;
      }

      // Log to AgentPerformanceLog for audit trail
      await base44.asServiceRole.entities.AgentPerformanceLog.create({
        agent_name: 'survey_health_monitor',
        action_type: 'alert_triggered',
        target_entity: 'PPCSurvey',
        target_id: alert.survey_id,
        output_data: alert,
        predicted_outcome: 'Admin notified for proactive calibration',
        confidence_score: alert.severity === 'critical' ? 90 : 70,
        tags: ['survey_health', alert.type, alert.severity],
      });
    }

    return Response.json({
      success: true,
      surveys_scanned: surveys.length,
      alerts_triggered: alerts.length,
      notifications_sent: notificationsSent,
      alerts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});