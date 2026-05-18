import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scheduled daily: close expired GameVoteSurveys and apply results
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = [];

    const activeSurveys = await base44.asServiceRole.entities.GameVoteSurvey.filter({ status: 'active' });

    for (const survey of activeSurveys) {
      if (!survey.closes_at || new Date(survey.closes_at) > now) continue;

      await base44.asServiceRole.entities.GameVoteSurvey.update(survey.id, { status: 'processing' });

      // Find winning option
      const options = survey.options || [];
      if (options.length === 0) continue;
      const winner = options.reduce((best, opt) => (opt.votes || 0) > (best.votes || 0) ? opt : best, options[0]);

      // Apply result for developer_applications type
      if (survey.survey_type === 'developer_applications' && winner.application_id) {
        await base44.asServiceRole.entities.DeveloperApplication.update(winner.application_id, {
          status: 'approved',
          survey_vote_count: winner.votes,
          survey_rank: 1,
          approved_at: now.toISOString()
        });

        // Notify all options' applicants
        for (const opt of options) {
          if (!opt.application_id) continue;
          const application = (await base44.asServiceRole.entities.DeveloperApplication.filter({ id: opt.application_id }))[0];
          if (application?.contact_email) {
            const won = opt.application_id === winner.application_id;
            await base44.integrations.Core.SendEmail({
              to: application.contact_email,
              subject: won ? `🎉 Community Voted — Your Game is Approved!` : `Community Vote Results`,
              body: won
                ? `The GamerGain community voted for "${application.game_title}"! You received ${winner.votes} votes. Log in to complete setup.`
                : `The community vote has concluded. "${application.game_title}" received ${opt.votes || 0} votes. You've been added to our priority waitlist for the next opening.`
            });
          }
        }
      }

      await base44.asServiceRole.entities.GameVoteSurvey.update(survey.id, {
        status: 'closed',
        results_applied: true,
        total_votes: options.reduce((s, o) => s + (o.votes || 0), 0)
      });

      results.push(`closed_survey_${survey.id}`);
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});