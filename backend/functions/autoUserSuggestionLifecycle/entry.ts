import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const suggestions = await base44.asServiceRole.entities.UserSuggestion.filter({ status: 'pending' });
    let addedToSurvey = 0;
    let rejected = 0;

    // Get today's feedback survey
    const today = new Date().toISOString().split('T')[0];
    const surveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ date: today, status: 'active' });
    const activeSurveyId = surveys.length > 0 ? surveys[0].id : null;

    for (const suggestion of suggestions) {
      // Top suggestions (10+ upvotes) → inject into active survey
      if ((suggestion.upvotes || 0) >= 10 && activeSurveyId) {
        await base44.asServiceRole.entities.UserSuggestion.update(suggestion.id, {
          status: 'added_to_survey',
          added_to_survey_id: activeSurveyId,
          added_to_survey_date: today
        });
        addedToSurvey++;
      }

      // Very old suggestions with 0 upvotes → auto reject after 30 days
      const created = new Date(suggestion.created_date);
      const daysOld = (Date.now() - created) / (1000 * 60 * 60 * 24);
      if (daysOld > 30 && (suggestion.upvotes || 0) === 0) {
        await base44.asServiceRole.entities.UserSuggestion.update(suggestion.id, { status: 'rejected' });
        rejected++;
      }
    }

    return Response.json({ success: true, addedToSurvey, rejected });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});