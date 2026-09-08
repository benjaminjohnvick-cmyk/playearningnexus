import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gateAndRun } from "../../sdk/autonomy-gate.ts";

// Scheduled: runs every hour to auto-distribute surveys to matched users — ROUTED THROUGH THE AUTONOMY KERNEL
// (survey domain). The distribution pass auto-runs once the survey domain has earned autonomy AND the global
// live gate is open; otherwise it's queued for the overseer (no notifications sent this run). Reversible.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active surveys
    const activeSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    if (!activeSurveys.length) return Response.json({ message: 'No active surveys' });

    const gate = await gateAndRun("survey",
      { summary: `Auto-distribute ${activeSurveys.length} active survey(s) to matched users`, reversible: true },
      async () => {

    // Get all users
    const users = await base44.asServiceRole.entities.User.list();

    let notificationsSent = 0;

    for (const survey of activeSurveys) {
      // Skip if survey reached sample size
      if ((survey.responses_count || 0) >= (survey.sample_size || 100)) continue;

      for (const user of users) {
        // Skip creator
        if (user.id === survey.creator_user_id) continue;

        // Check if user already responded
        const existing = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
          survey_id: survey.id,
          user_id: user.id
        });
        if (existing.length > 0) continue;

        // Use AI to determine match score
        const prompt = `You are a survey matching AI. Determine if this user is a good match for this survey.

Survey: "${survey.title}"
Survey Type: ${survey.survey_type}
Survey Description: ${survey.product_description || 'N/A'}

User Profile:
- Email: ${user.email}
- Total Earnings: $${user.total_earnings || 0}
- Role: ${user.role}

Should this user be notified about this survey? Return match_score (0-100) and notify (boolean).`;

        const match = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              match_score: { type: 'number' },
              notify: { type: 'boolean' },
              reason: { type: 'string' }
            }
          }
        });

        if (match.notify && match.match_score >= 60) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'survey_match',
            title: '🎯 New Survey Match!',
            message: `AI found a survey for you: "${survey.title}" — Earn $${survey.cost_per_response || 4} per response!`,
            related_id: survey.id,
            is_read: false
          });
          notificationsSent++;
        }
      }
    }

    return notificationsSent;
      });

    if (!gate.executed) return Response.json({ success: true, notifications_sent: 0, surveys_processed: activeSurveys.length, queued: gate.pending, gate_reason: gate.reason });
    return Response.json({ success: true, notifications_sent: gate.result ?? 0, surveys_processed: activeSurveys.length });
  } catch (error) {
    console.error('AI auto-distribute error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});