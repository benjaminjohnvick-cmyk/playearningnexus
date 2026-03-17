import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Sends targeted survey-match notifications to respondents whose demographics
 * and verified skills align with newly active or recently updated surveys.
 *
 * Called by automation when a PPCSurvey is created/updated OR on a schedule.
 * Payload: { survey_id? } — if provided, only notify for that survey.
 *                           If omitted, sweeps all active surveys.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { survey_id } = body;

    // Load surveys to process
    let surveys;
    if (survey_id) {
      surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id, status: 'active' });
    } else {
      surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    }

    if (!surveys.length) return Response.json({ ok: true, message: 'No active surveys to notify about' });

    // Load all users with respondent profiles
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const respondents = allUsers.filter(u => u.email && u.respondent_profile);

    let totalNotified = 0;
    const results = [];

    for (const survey of surveys) {
      const targeting = survey.targeting || {};
      const matchedUsers = respondents.filter(u => isMatch(u.respondent_profile, targeting));

      let emailsSent = 0;
      let inAppSent = 0;

      for (const user of matchedUsers) {
        const prefs = user.notification_preferences || {};

        // Skip if user has opted out of survey opportunities
        if (prefs.survey_opportunities === false) continue;

        // In-app notification (always, if opted in)
        if (prefs.in_app_enabled !== false) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'survey_opportunity',
            title: '🎯 New Survey Matches Your Profile!',
            message: `"${survey.title}" — earn $${survey.cost_per_response || 2} per response. This survey targets your demographic.`,
            status: 'unread',
            delivery_method: ['in_app'],
          });
          inAppSent++;
        }

        // Email notification
        if (prefs.email_enabled !== false) {
          const profile = user.respondent_profile;
          const interestMatch = getInterestMatches(profile.interests || [], survey);

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `🎯 A survey was created just for you — Earn $${survey.cost_per_response || 2}`,
            body: buildEmailBody(user, survey, interestMatch),
          });
          emailsSent++;
        }
      }

      results.push({ survey_id: survey.id, title: survey.title, matched: matchedUsers.length, emails_sent: emailsSent, in_app_sent: inAppSent });
      totalNotified += matchedUsers.length;
    }

    return Response.json({ ok: true, surveys_processed: surveys.length, total_notified: totalNotified, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Returns true if the user's respondent profile satisfies the survey's targeting criteria */
function isMatch(profile, targeting) {
  if (!profile) return false;

  // If no targeting rules set, survey is open to everyone
  const hasAnyRule = Object.values(targeting).some(v => Array.isArray(v) ? v.length > 0 : !!v);
  if (!hasAnyRule) return true;

  // Age range check
  if (targeting.age_ranges?.length > 0 && profile.age_range) {
    if (!targeting.age_ranges.includes(profile.age_range)) return false;
  }

  // Gender check
  if (targeting.genders?.length > 0 && profile.gender) {
    if (!targeting.genders.includes(profile.gender)) return false;
  }

  // Employment
  if (targeting.employment_statuses?.length > 0 && profile.employment_status) {
    if (!targeting.employment_statuses.includes(profile.employment_status)) return false;
  }

  // Education
  if (targeting.education_levels?.length > 0 && profile.education_level) {
    if (!targeting.education_levels.includes(profile.education_level)) return false;
  }

  // Income
  if (targeting.income_ranges?.length > 0 && profile.household_income) {
    if (!targeting.income_ranges.includes(profile.household_income)) return false;
  }

  // Required interests — at least 1 must overlap
  if (targeting.required_interests?.length > 0) {
    const userInterests = profile.interests || [];
    const hasOverlap = targeting.required_interests.some(i => userInterests.includes(i));
    if (!hasOverlap) return false;
  }

  // Required skills — at least 1 must overlap
  if (targeting.required_skills?.length > 0) {
    const userSkills = profile.verified_skills || [];
    const hasOverlap = targeting.required_skills.some(s => userSkills.includes(s));
    if (!hasOverlap) return false;
  }

  return true;
}

function getInterestMatches(userInterests, survey) {
  const targeting = survey.targeting || {};
  if (!targeting.required_interests?.length) return [];
  return userInterests.filter(i => targeting.required_interests.includes(i));
}

function buildEmailBody(user, survey, interestMatches) {
  const name = user.full_name || 'there';
  const earn = survey.cost_per_response || 2;
  const matchNote = interestMatches.length > 0
    ? `This survey matches your interests in: ${interestMatches.join(', ')}.`
    : 'This survey matches your demographic profile.';

  return `Hi ${name},

A new survey on GamerGain was specifically targeted to people like you!

📋 Survey: "${survey.title}"
💵 Earn: $${earn} per completed response
🎯 Why you: ${matchNote}

👉 Complete it now before spots fill up:
https://gamergain.base44.app/Surveys

Tips for a fast payout:
• Answer all questions honestly and thoughtfully
• Make sure your profile is complete for more survey invites
• Payouts are processed automatically after quality check

Happy earning!
— The GamerGain Team

---
You received this because your profile matches this survey's audience.
To update your notification preferences, visit your Profile → Settings page.`;
}