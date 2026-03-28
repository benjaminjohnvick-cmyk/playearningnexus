import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Scheduled: runs every hour to auto-distribute surveys to matched users
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active surveys
    const activeSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    if (!activeSurveys.length) return Response.json({ message: 'No active surveys' });

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

    return Response.json({ success: true, notifications_sent: notificationsSent, surveys_processed: activeSurveys.length });
  } catch (error) {
    console.error('AI auto-distribute error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});