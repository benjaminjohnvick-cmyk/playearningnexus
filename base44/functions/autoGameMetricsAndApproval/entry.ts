import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const { event, data } = payload;

    // If triggered by entity automation (new game created)
    if (event?.type === 'create') {
      const game = data || await base44.asServiceRole.entities.Game.get(event.entity_id);
      if (!game || game.status !== 'pending') return Response.json({ skipped: true });

      const { InvokeLLM } = base44.asServiceRole.integrations.Core;
      const review = await InvokeLLM({
        prompt: `Review this game submission for the GamerGain platform and decide if it should be approved or rejected.
Game Title: ${game.title}
Description: ${game.description}
Category: ${game.category}
Platform: ${(game.platform || []).join(', ')}
Price: $${game.price || 0}

Criteria: Must have a title and description, must be a real game category, must not be adult/gambling/illegal content.
Respond with JSON: { "decision": "approved" | "rejected", "reason": "string" }`,
        response_json_schema: { type: 'object', properties: { decision: { type: 'string' }, reason: { type: 'string' } } }
      });

      await base44.asServiceRole.entities.Game.update(game.id, {
        status: review.decision === 'approved' ? 'approved' : 'rejected',
        submission_date: new Date().toISOString().split('T')[0]
      });

      return Response.json({ success: true, decision: review.decision, reason: review.reason });
    }

    // Scheduled: update aggregated metrics from ratings
    const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    let updated = 0;

    for (const game of games) {
      const ratings = await base44.asServiceRole.entities.GameRating.filter({ game_id: game.id });
      if (ratings.length === 0) continue;

      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      await base44.asServiceRole.entities.Game.update(game.id, {
        average_rating: Math.round(avg * 10) / 10,
        total_ratings: ratings.length
      });
      updated++;
    }

    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});