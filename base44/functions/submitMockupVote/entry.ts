import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * submitMockupVote
 * Actions:
 *  - get_today  : Returns today's MockupVoteSurvey + whether user already voted
 *  - vote       : Submit votes for one or all comparisons
 *  - tally      : Tally final votes, declare winners, generate implementation specs, award entries
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── SCHEDULED TALLY — no action/body (called by automation) ──────────
    const today = new Date().toISOString().split('T')[0];
    if (!action || action === 'tally_today') {
      const surveys = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ date: today, status: 'active' });
      if (!surveys.length) return Response.json({ success: true, message: 'No active survey to tally today' });

      const survey = surveys[0];
      const updatedComparisons = await Promise.all(survey.comparisons.map(async (cmp) => {
        const aVotes = cmp.option_a?.votes || 0;
        const bVotes = cmp.option_b?.votes || 0;
        const winner = aVotes > bVotes ? 'a' : bVotes > aVotes ? 'b' : 'tie';
        const winningOption = winner === 'a' ? cmp.option_a : cmp.option_b;

        const implSpec = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a senior React/Tailwind developer for GamerGain (gaming + survey platform, red/white theme).
The community voted for this design to be implemented:

Feature: "${cmp.feature_name}"
Winning Design: "${winningOption?.title}"
Description: ${winningOption?.description}
Total votes: ${Math.max(aVotes, bVotes)} (out of ${aVotes + bVotes})

Write a detailed, actionable implementation plan:
1. Which file(s) to create or modify (use actual GamerGain page/component paths)
2. Key UI changes with Tailwind class examples
3. Any new entity fields or backend function needed
4. Step-by-step implementation order

Be specific and concise. Format as markdown.`
        }).catch(() => 'Implementation spec pending admin review.');

        return { ...cmp, winner, implementation_spec: typeof implSpec === 'string' ? implSpec : JSON.stringify(implSpec) };
      }));

      await base44.asServiceRole.entities.MockupVoteSurvey.update(survey.id, {
        comparisons: updatedComparisons,
        status: 'implementing'
      });

      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 3)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'achievement_unlocked',
          title: '🗳️ Mockup Vote Results Ready',
          message: `Community voted on ${updatedComparisons.length} designs. Implementation specs generated. Ready to deploy!`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/FeedbackAdminDashboard'
        }).catch(() => {});
      }

      return Response.json({ success: true, survey_id: survey.id, comparisons_tallied: updatedComparisons.length });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── GET TODAY ──────────────────────────────────────────────────────────
    if (action === 'get_today') {
      const surveys = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ date: today, status: 'active' });
      if (!surveys.length) return Response.json({ survey: null, already_completed: false });

      const survey = surveys[0];
      // Check if user voted on all comparisons
      const allVoted = survey.comparisons.every(c =>
        (c.option_a?.voter_ids || []).includes(user.id) ||
        (c.option_b?.voter_ids || []).includes(user.id)
      );

      return Response.json({ survey, already_completed: allVoted });
    }

    // ── VOTE ──────────────────────────────────────────────────────────────
    if (action === 'vote') {
      // votes: [ { comparison_id: 'cmp_1', choice: 'a' | 'b' }, ... ]
      const { survey_id, votes } = body;
      if (!survey_id || !votes?.length) return Response.json({ error: 'survey_id and votes required' }, { status: 400 });

      const surveys = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ id: survey_id });
      const survey = surveys[0];
      if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });

      const comparisons = [...(survey.comparisons || [])];
      let newVotesCounted = 0;

      for (const v of votes) {
        const cmpIdx = comparisons.findIndex(c => c.id === v.comparison_id);
        if (cmpIdx === -1) continue;

        const cmp = { ...comparisons[cmpIdx] };
        const alreadyVotedA = (cmp.option_a?.voter_ids || []).includes(user.id);
        const alreadyVotedB = (cmp.option_b?.voter_ids || []).includes(user.id);
        if (alreadyVotedA || alreadyVotedB) continue; // already voted on this comparison

        if (v.choice === 'a') {
          cmp.option_a = {
            ...cmp.option_a,
            votes: (cmp.option_a?.votes || 0) + 1,
            voter_ids: [...(cmp.option_a?.voter_ids || []), user.id]
          };
        } else {
          cmp.option_b = {
            ...cmp.option_b,
            votes: (cmp.option_b?.votes || 0) + 1,
            voter_ids: [...(cmp.option_b?.voter_ids || []), user.id]
          };
        }
        comparisons[cmpIdx] = cmp;
        newVotesCounted++;
      }

      const totalResponses = (survey.total_responses || 0) + (newVotesCounted > 0 ? 1 : 0);
      await base44.asServiceRole.entities.MockupVoteSurvey.update(survey_id, { comparisons, total_responses: totalResponses });

      // Award contest entry for completing all comparisons
      if (newVotesCounted === comparisons.length || votes.length >= comparisons.length) {
        await base44.asServiceRole.entities.ContestParticipation.create({
          user_id: user.id,
          contest_type: 'mockup_vote_survey',
          entry_source: 'daily_mockup_survey',
          entries_earned: 1,
          date: today
        }).catch(() => {});

        // Update user referral contest entries
        const currentEntries = user.contest_entries || 0;
        await base44.asServiceRole.entities.User.update(user.id, {
          contest_entries: currentEntries + 1
        }).catch(() => {});
      }

      return Response.json({ success: true, votes_counted: newVotesCounted });
    }

    // ── TALLY ─────────────────────────────────────────────────────────────
    if (action === 'tally') {
      const { survey_id } = body;
      const surveys = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ id: survey_id });
      const survey = surveys[0];
      if (!survey) return Response.json({ error: 'Not found' }, { status: 404 });

      const updatedComparisons = await Promise.all(survey.comparisons.map(async (cmp) => {
        const aVotes = cmp.option_a?.votes || 0;
        const bVotes = cmp.option_b?.votes || 0;
        const winner = aVotes > bVotes ? 'a' : bVotes > aVotes ? 'b' : 'tie';
        const winningOption = winner === 'a' ? cmp.option_a : cmp.option_b;

        // Generate implementation spec for winner
        const implSpec = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a senior React/Tailwind developer for GamerGain (gaming + survey platform, red/white theme).
The community voted for this design to be implemented:

Feature: "${cmp.feature_name}"
Winning Design: "${winningOption?.title}"
Description: ${winningOption?.description}
Total votes: ${Math.max(aVotes, bVotes)} (out of ${aVotes + bVotes})

Write a detailed, actionable implementation plan:
1. Which file(s) to create or modify (use actual GamerGain page/component paths)
2. Key UI changes with Tailwind class examples
3. Any new entity fields or backend function needed
4. Step-by-step implementation order

Be specific and concise. Format as markdown.`
        }).catch(() => 'Implementation spec pending admin review.');

        return { ...cmp, winner, implementation_spec: typeof implSpec === 'string' ? implSpec : JSON.stringify(implSpec) };
      }));

      await base44.asServiceRole.entities.MockupVoteSurvey.update(survey_id, {
        comparisons: updatedComparisons,
        status: 'implementing'
      });

      // Notify admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 3)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'achievement_unlocked',
          title: '🗳️ Mockup Vote Results Ready',
          message: `Community voted on ${updatedComparisons.length} designs. Implementation specs generated. Ready to deploy!`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/FeedbackAdminDashboard'
        }).catch(() => {});
      }

      return Response.json({ success: true, comparisons: updatedComparisons });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('submitMockupVote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});