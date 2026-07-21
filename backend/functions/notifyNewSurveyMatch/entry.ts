import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity automation: triggered when a PPCSurvey is created/activated
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.id) {
      return Response.json({ error: 'Missing survey data' }, { status: 400 });
    }

    const survey = data;

    // Find respondents who match this survey's targeting criteria
    const respondentProfiles = await base44.asServiceRole.entities.RespondentProfile.list();

    const matchedUsers = respondentProfiles
      .filter(profile => {
        // Basic matching: age range, interests, etc.
        if (survey.target_age_min && profile.age < survey.target_age_min) return false;
        if (survey.target_age_max && profile.age > survey.target_age_max) return false;
        if (survey.target_interests && survey.target_interests.length > 0) {
          const hasMatch = survey.target_interests.some(interest =>
            profile.interests?.includes(interest)
          );
          if (!hasMatch) return false;
        }
        return true;
      })
      .map(p => p.user_id);

    // Send push notifications to matched users
    const notificationPromises = matchedUsers.map(userId =>
      base44.asServiceRole.functions.invoke('sendPushNotification', {
        user_id: userId,
        title: '🎯 New Survey Match!',
        body: `${survey.title} - Earn $${survey.cost_per_response}`,
        tag: `survey-${survey.id}`,
        url: `/ExploreSurveys?survey_id=${survey.id}`
      })
    );

    const results = await Promise.allSettled(notificationPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    console.log(`Survey ${survey.id} matched ${successful}/${matchedUsers.length} users`);

    return Response.json({
      survey_id: survey.id,
      matched_users: matchedUsers.length,
      notifications_sent: successful
    });
  } catch (error) {
    console.error('Survey match notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});