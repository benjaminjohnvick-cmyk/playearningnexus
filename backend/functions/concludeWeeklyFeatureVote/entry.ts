import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Concludes any active feature-vote survey whose window has closed:
// correlates responses, ranks candidates by votes, picks the winner, generates
// an implementation spec, records a FeatureMockup, and hands the winner to
// aiAutomaticFeatureImplementation. Intended to run weekly after generation.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const active = await base44.asServiceRole.entities.FeatureVoteSurvey.filter({ status: 'active' }, '-created_date', 20);
    const now = Date.now();
    const concluded = [];

    for (const survey of active) {
      // Only conclude once the voting window has elapsed.
      if (survey.closes_at && new Date(survey.closes_at).getTime() > now) continue;

      const candidates = [...(survey.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const winner = candidates[0];

      if (!winner || (winner.votes || 0) === 0) {
        // No engagement — close without a winner.
        await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, { status: 'closed' });
        continue;
      }

      // Generate an implementation spec for the winning idea.
      let spec = '';
      try {
        const ai = await base44.integrations.Core.InvokeLLM({
          prompt: `Users voted for this to be built next on a play-to-earn gaming platform.
Write a concise, developer-ready implementation spec (5-8 bullet points): data model
changes, UI screens/components, backend functions, and rollout steps.

WINNER (${winner.type}): ${winner.title}
Description: ${winner.description || 'n/a'}
Votes: ${winner.votes} of ${survey.total_responses} responses.`,
          model: 'gpt_5_mini',
        });
        spec = typeof ai === 'string' ? ai : JSON.stringify(ai);
      } catch {
        spec = `Implement "${winner.title}" (${winner.type}). Winner of the week-of-${survey.week_of} vote with ${winner.votes} votes. Manual spec required — LLM unavailable.`;
      }

      // Record a FeatureMockup entry flagged for implementation.
      let mockupId = '';
      try {
        const mockup = await base44.asServiceRole.entities.FeatureMockup.create({
          feature_name: winner.title,
          title: winner.title,
          description: winner.description || '',
          category: winner.type === 'game' ? 'game_mechanic' : winner.type === 'ui_ux' ? 'platform_ui' : 'dashboard',
          implementation_spec: spec,
          total_survey_votes: winner.votes,
          top_response: winner.title,
          implemented: false,
          mockup_phase: 'implementing',
        });
        mockupId = mockup.id;
      } catch { /* optional */ }

      // Mark the originating suggestion as in-mockup.
      if (winner.source_suggestion_id) {
        try { await base44.asServiceRole.entities.UserSuggestion.update(winner.source_suggestion_id, { in_mockup: true, status: 'pending' }); } catch { /* ignore */ }
      }

      await base44.asServiceRole.entities.FeatureVoteSurvey.update(survey.id, {
        status: 'concluded',
        winner_candidate_id: winner.candidate_id,
        winner_title: winner.title,
        implementation_spec: spec,
        implementation_triggered: true,
      });

      // Hand off to the existing auto-implementation planner (best-effort).
      try {
        await base44.functions.invoke('aiAutomaticFeatureImplementation', {
          source: 'weekly_feature_vote',
          feature: winner.title,
          spec,
          mockup_id: mockupId,
        });
      } catch { /* the planner may run on its own schedule */ }

      concluded.push({ survey_id: survey.id, winner: winner.title, votes: winner.votes });
    }

    return Response.json({ success: true, concluded_count: concluded.length, concluded });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to conclude surveys' }, { status: 500 });
  }
});
