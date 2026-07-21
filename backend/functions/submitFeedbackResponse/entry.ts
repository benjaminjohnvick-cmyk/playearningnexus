import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { survey_id, survey_date, answers, completion_time_seconds, dismissed_without_completing } = body;

    // Check if already submitted
    const existing = await base44.asServiceRole.entities.FeedbackSurveyResponse.filter({
      survey_id,
      user_id: user.id
    });

    let response;
    if (existing.length > 0) {
      response = await base44.asServiceRole.entities.FeedbackSurveyResponse.update(existing[0].id, {
        answers: answers || [],
        completion_time_seconds,
        dismissed_without_completing: dismissed_without_completing || false
      });
    } else {
      response = await base44.asServiceRole.entities.FeedbackSurveyResponse.create({
        survey_id,
        user_id: user.id,
        survey_date,
        answers: answers || [],
        completion_time_seconds,
        dismissed_without_completing: dismissed_without_completing || false
      });
    }

    // Increment response count on survey
    const surveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ id: survey_id });
    if (surveys.length > 0 && !dismissed_without_completing) {
      await base44.asServiceRole.entities.DailyFeedbackSurvey.update(survey_id, {
        total_responses: (surveys[0].total_responses || 0) + (existing.length === 0 ? 1 : 0)
      });
    }

    return Response.json({ success: true, response_id: response.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});