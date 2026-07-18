import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Creates the weekly, mandatory, $0.10 feature/game vote survey from the top
// user suggestions, and notifies active users. Intended to run once per week
// (e.g. Monday) via a schedule or the feature_vote_growth_agent.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Don't create a second active survey for the same week.
    const existing = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 1);
    if (existing.length) {
      return Response.json({ skipped: true, reason: 'An active feature vote survey already exists', survey_id: existing[0].id });
    }

    // Pull the most-upvoted pending suggestions for games / features / UI.
    let suggestions = [];
    try {
      suggestions = await base44.asServiceRole.entities.UserSuggestion.filter(
        { status: 'pending' }, '-upvotes', 50
      );
    } catch { /* entity optional */ }

    const wanted = ['games', 'features', 'ui_ux'];
    const pool = suggestions
      .filter((s) => wanted.includes(s.category) && !s.added_to_survey)
      .slice(0, 6);

    // Fallback: if there aren't enough suggestions, pull unimplemented mockups.
    if (pool.length < 3) {
      try {
        const mockups = await base44.asServiceRole.entities.FeatureMockup.filter({ implemented: false }, '-total_survey_votes', 6);
        for (const m of mockups) {
          pool.push({ id: m.id, suggestion: m.feature_name || m.title, description: m.description, category: 'features', _mockup: true });
          if (pool.length >= 6) break;
        }
      } catch { /* optional */ }
    }

    if (pool.length === 0) {
      return Response.json({ skipped: true, reason: 'No candidate suggestions available this week' });
    }

    const candidates = pool.map((s, i) => ({
      candidate_id: `c${i}_${(s.id || 'x').slice(-6)}`,
      type: s.category === 'games' ? 'game' : s.category === 'ui_ux' ? 'ui_ux' : 'feature',
      title: s.suggestion || s.title || 'Untitled idea',
      description: s.description || '',
      source_suggestion_id: s._mockup ? '' : (s.id || ''),
      votes: 0,
      voter_ids: [],
    }));

    // Compute the Monday of the current week (server has no Date.now guard here).
    const now = new Date();
    const day = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    const weekOf = monday.toISOString().slice(0, 10);
    const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const survey = await base44.asServiceRole.entities.FeatureVoteSurvey.create({
      week_of: weekOf,
      title: `What should we build next? (Week of ${weekOf})`,
      description: 'Vote for the games and features you want most. Takes 30 seconds and pays $0.10. Optional — vote whenever you like.',
      status: 'active',
      is_mandatory: false,
      reward_amount: 0.1,
      closes_at: closesAt,
      candidates,
      total_responses: 0,
      responder_ids: [],
      implementation_triggered: false,
    });

    // Mark the source suggestions as added to a survey.
    for (const s of pool) {
      if (s._mockup) continue;
      try { await base44.asServiceRole.entities.UserSuggestion.update(s.id, { added_to_survey: true, added_to_survey_id: survey.id, added_to_survey_date: new Date().toISOString() }); } catch { /* ignore */ }
    }

    // Notify a bounded set of recently-active users.
    let notified = 0;
    try {
      const users = await base44.asServiceRole.entities.User.list('-updated_date', 500);
      for (const u of users) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            title: '🗳️ Weekly Feature Vote — earn $0.10',
            message: 'This week\'s vote is open. Tell us which games & features to build next and earn $0.10. Optional — vote anytime.',
            notification_type: 'feature_vote_survey',
            related_entity_id: survey.id,
          });
          notified++;
        } catch { /* skip individual failures */ }
      }
    } catch { /* user list optional */ }

    return Response.json({ success: true, survey_id: survey.id, candidates: candidates.length, notified });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to generate survey' }, { status: 500 });
  }
});
