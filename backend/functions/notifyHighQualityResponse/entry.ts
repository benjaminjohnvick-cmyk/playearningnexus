import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity automation: triggered when a PPCSurveyResponse is created/updated
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.id || !data?.survey_id) {
      return Response.json({ error: 'Missing response data' }, { status: 400 });
    }

    const response = data;

    // Only notify for high-quality responses (score > 75)
    if (!response.quality_score || response.quality_score < 75) {
      return Response.json({ skipped: 'Low quality response' });
    }

    // Get survey details
    const survey = await base44.asServiceRole.entities.PPCSurvey.get(response.survey_id);
    if (!survey) {
      return Response.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Notify the survey creator
    await base44.asServiceRole.functions.invoke('sendPushNotification', {
      user_id: survey.creator_user_id,
      title: '✅ High-Quality Response',
      body: `Quality score: ${response.quality_score}% - ${survey.title}`,
      tag: `response-${response.id}`,
      url: `/SurveyAnalytics?survey_id=${survey.id}`
    });

    return Response.json({
      response_id: response.id,
      quality_score: response.quality_score,
      creator_notified: true
    });
  } catch (error) {
    console.error('Response notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});