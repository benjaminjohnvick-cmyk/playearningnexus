import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const activeSurveys = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ status: 'active' });
    let concluded = 0;

    for (const survey of activeSurveys) {
      const surveyDate = new Date(survey.date);
      const daysSince = (Date.now() - surveyDate) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) continue; // Let surveys run for at least 3 days

      const updatedComparisons = (survey.comparisons || []).map(comp => {
        const aVotes = comp.option_a?.votes || 0;
        const bVotes = comp.option_b?.votes || 0;
        let winner = 'pending';
        if (aVotes > bVotes) winner = 'a';
        else if (bVotes > aVotes) winner = 'b';
        else if (aVotes > 0 && bVotes > 0) winner = 'tie';

        return { ...comp, winner };
      });

      // AI-generate implementation spec for winners
      const { InvokeLLM } = base44.asServiceRole.integrations.Core;
      const winners = updatedComparisons.filter(c => c.winner !== 'pending' && c.winner !== 'tie');

      for (const comp of winners) {
        if (comp.implementation_spec) continue;
        const winnerOption = comp.winner === 'a' ? comp.option_a : comp.option_b;
        const spec = await InvokeLLM({
          prompt: `Generate a brief implementation specification for this winning UI feature:
Feature: ${comp.feature_name}
Winner: ${winnerOption?.title} - ${winnerOption?.description}
Category: ${comp.category}
User Feedback Source: ${comp.source_feedback}

Write a concise technical implementation spec (2-3 sentences) that a developer can follow.`,
        });
        comp.implementation_spec = spec;
      }

      await base44.asServiceRole.entities.MockupVoteSurvey.update(survey.id, {
        status: 'closed',
        comparisons: updatedComparisons
      });
      concluded++;
    }

    return Response.json({ success: true, concluded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});