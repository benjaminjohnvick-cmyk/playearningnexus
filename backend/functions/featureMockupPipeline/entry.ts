import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Feature Mockup Pipeline
 * Actions:
 *   generate_mockups  — takes survey response data from a FeatureMockup record, generates 3 AI mockup options
 *   tally_votes       — tallies mockup votes, declares winner if deadline passed or threshold met
 *   implement_winner  — generates detailed implementation spec + code hints for winning mockup via AI
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, mockup_id } = body;

    // --- generate_mockups ---
    if (action === 'generate_mockups') {
      const records = await base44.asServiceRole.entities.FeatureMockup.filter({ id: mockup_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'FeatureMockup not found' }, { status: 404 });

      // Use survey response data to understand what users want
      const topResponses = (record.survey_responses || [])
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3)
        .map(r => `"${r.option}" (${r.pct}% of votes)`).join(', ');

      const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a UX designer for GamerGain, a gaming + survey earnings platform.

Feature: "${record.feature_name}" (Category: ${record.category})
Survey question asked: "${record.survey_question}"
Top survey responses: ${topResponses || record.top_response || 'Users want a better experience'}

Generate 3 distinct mockup concepts for this feature. Each should be a concrete, implementable UI design.

Return JSON with this exact structure:
{
  "mockups": [
    {
      "id": "mockup_1",
      "title": "Short catchy name",
      "description": "2 sentence description of what the user sees",
      "ui_spec": "Detailed layout description: components, colors, interactions, flow - 3-5 sentences"
    },
    { "id": "mockup_2", ... },
    { "id": "mockup_3", ... }
  ]
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            mockups: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  ui_spec: { type: 'string' }
                }
              }
            }
          }
        }
      });

      const mockupsWithVotes = (generated.mockups || []).map(m => ({ ...m, votes: 0, voter_ids: [] }));

      // Set vote deadline 7 days from now
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await base44.asServiceRole.entities.FeatureMockup.update(mockup_id, {
        mockups: mockupsWithVotes,
        phase: 'vote_phase',
        vote_deadline: deadline,
      });

      return Response.json({ success: true, mockups: mockupsWithVotes, deadline });
    }

    // --- tally_votes ---
    if (action === 'tally_votes') {
      const records = await base44.asServiceRole.entities.FeatureMockup.filter({ id: mockup_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

      const mockups = record.mockups || [];
      if (mockups.length === 0) return Response.json({ error: 'No mockups to tally' }, { status: 400 });

      const sorted = [...mockups].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const winner = sorted[0];
      const totalVotes = mockups.reduce((s, m) => s + (m.votes || 0), 0);
      const isDeadlinePassed = record.vote_deadline && new Date(record.vote_deadline) < new Date();
      const hasEnoughVotes = totalVotes >= 10;

      if (isDeadlinePassed || hasEnoughVotes) {
        await base44.asServiceRole.entities.FeatureMockup.update(mockup_id, {
          winning_mockup_id: winner.id,
          winning_mockup_title: winner.title,
          total_mockup_votes: totalVotes,
          phase: 'implementing',
        });
        return Response.json({ success: true, winner, totalVotes, phase: 'implementing' });
      }

      return Response.json({ success: true, leading: winner, totalVotes, phase: 'vote_phase', message: 'Voting still open' });
    }

    // --- implement_winner ---
    if (action === 'implement_winner') {
      const records = await base44.asServiceRole.entities.FeatureMockup.filter({ id: mockup_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

      const winnerMockup = (record.mockups || []).find(m => m.id === record.winning_mockup_id);
      if (!winnerMockup) return Response.json({ error: 'Winner mockup not found' }, { status: 400 });

      const implSpec = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a senior React/Tailwind developer for GamerGain (gaming + survey earnings platform).

A user community voted for this feature to be implemented:
Feature: "${record.feature_name}" (${record.category})
Winning Mockup: "${winnerMockup.title}"
Description: ${winnerMockup.description}
UI Spec: ${winnerMockup.ui_spec}

Generate a detailed implementation plan including:
1. Which existing page/component to modify
2. New components needed (file paths)
3. Data entities or fields needed
4. Key React/Tailwind code snippets for the main UI elements
5. Any backend function needed

Be specific and actionable. Format as structured markdown.`,
        model: 'claude_sonnet_4_6'
      });

      await base44.asServiceRole.entities.FeatureMockup.update(mockup_id, {
        implementation_spec: typeof implSpec === 'string' ? implSpec : implSpec?.text || JSON.stringify(implSpec),
        phase: 'implemented',
        implemented_at: new Date().toISOString(),
      });

      // Notify admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 3)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'achievement_unlocked',
          title: `🚀 Feature Ready: "${record.feature_name}"`,
          message: `The community voted for "${winnerMockup.title}". AI has generated the implementation spec. Ready to deploy!`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/ABTestingCenter',
        });
      }

      return Response.json({ success: true, implementation_spec: implSpec, feature: record.feature_name, mockup: winnerMockup.title });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});