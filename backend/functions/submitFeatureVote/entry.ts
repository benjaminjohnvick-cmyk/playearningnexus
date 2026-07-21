import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Records a user's votes on the weekly feature/game survey, credits the $0.10
// reward once, and prevents double-voting. Called from the WeeklyFeatureVote page.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { survey_id, candidate_ids } = await req.json();
    if (!survey_id || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return Response.json({ error: 'survey_id and at least one candidate_id are required' }, { status: 400 });
    }

    const surveys = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ id: survey_id });
    const survey = surveys[0];
    if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });
    if (survey.status !== 'active') return Response.json({ error: 'This survey is closed' }, { status: 409 });

    const responderIds = survey.responder_ids || [];
    if (responderIds.includes(user.id)) {
      return Response.json({ error: 'You have already voted in this survey', already_voted: true }, { status: 409 });
    }

    // Apply votes to the chosen candidates.
    const chosen = new Set(candidate_ids);
    const candidates = (survey.candidates || []).map((c) => {
      if (chosen.has(c.candidate_id)) {
        return { ...c, votes: (c.votes || 0) + 1, voter_ids: [...(c.voter_ids || []), user.id] };
      }
      return c;
    });

    await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, {
      candidates,
      total_responses: (survey.total_responses || 0) + 1,
      responder_ids: [...responderIds, user.id],
    });

    // Credit the $0.10 reward exactly once.
    const reward = survey.reward_amount || 0.1;
    try {
      await base44.asServiceRole.entities.Transaction.create({
        user_id: user.id,
        amount: reward,
        currency: 'USD',
        transaction_type: 'survey_earning',
        status: 'completed',
        notes: `Weekly feature vote survey (${survey.week_of})`,
      });
    } catch { /* non-fatal — vote still counts */ }

    // Best-effort daily earnings roll-up.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      if (existing[0]) {
        await base44.asServiceRole.entities.DailyEarnings.update(existing[0].id, { amount: (existing[0].amount || 0) + reward });
      } else {
        await base44.asServiceRole.entities.DailyEarnings.create({ user_id: user.id, date: today, amount: reward, source: 'feature_vote' });
      }
    } catch { /* optional */ }

    // Completing a survey unlocks any pending referral-post rewards ($0.10/post).
    let referral_rewards_credited = 0;
    try {
      const res = await base44.asServiceRole.functions.invoke('creditPendingReferralPostRewards', { user_id: user.id });
      referral_rewards_credited = res?.credited_amount || 0;
    } catch { /* non-fatal */ }

    return Response.json({ success: true, reward, voted_for: candidate_ids.length, referral_rewards_credited });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to submit vote' }, { status: 500 });
  }
});
