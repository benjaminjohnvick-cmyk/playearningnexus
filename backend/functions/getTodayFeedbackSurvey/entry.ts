import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // Get today's active survey
    const surveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ date: today, status: 'active' });
    if (!surveys.length) return Response.json({ survey: null, already_completed: false });

    const survey = surveys[0];

    // Check if user already responded today
    const existing = await base44.asServiceRole.entities.FeedbackSurveyResponse.filter({
      survey_id: survey.id,
      user_id: user.id
    });

    const already_completed = existing.length > 0 && !existing[0].dismissed_without_completing;

    return Response.json({ survey, already_completed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});