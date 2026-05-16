import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get games user played but hasn't reviewed
    const userActivities = await base44.asServiceRole.entities.UserActivity.filter({
      user_id: user.id,
      activity_type: 'game_played'
    }, '-created_date', 20);

    const playedGameIds = [...new Set(userActivities.map(a => a.game_id).filter(Boolean))];

    const existingReviews = await base44.asServiceRole.entities.GameRating.filter({
      user_id: user.id,
      game_id: { $in: playedGameIds }
    });

    const reviewedIds = new Set(existingReviews.map(r => r.game_id));
    const unreviewedGameIds = playedGameIds.filter(id => !reviewedIds.has(id)).slice(0, 5);

    if (unreviewedGameIds.length === 0) {
      return Response.json({ message: 'No games to review' });
    }

    // Get games data
    const games = await base44.asServiceRole.entities.Game.filter({
      id: { $in: unreviewedGameIds }
    });

    // Generate reviews using AI
    const createdReviews = [];
    for (const game of games) {
      try {
        // Use LLM to generate review based on game metadata
        const reviewResponse = await base44.integrations.Core.InvokeLLM({
          prompt: `Generate a short, authentic game review (2-3 sentences) for "${game.title}" (${game.category} game). Be conversational and mention fun aspects without spoilers.`,
          response_json_schema: {
            type: 'object',
            properties: {
              review_text: { type: 'string' },
              rating: { type: 'number', minimum: 1, maximum: 5 }
            }
          }
        });

        const review = await base44.asServiceRole.entities.GameRating.create({
          user_id: user.id,
          game_id: game.id,
          rating: Math.round(reviewResponse.data.rating),
          review: reviewResponse.data.review_text,
          would_recommend: reviewResponse.data.rating >= 4
        });

        createdReviews.push(review);

        // Award points for review
        await base44.auth.updateMe({
          points: (user.points || 0) + 5
        });
      } catch (e) {
        // Continue with next game
      }
    }

    return Response.json({
      success: true,
      reviews_created: createdReviews.length,
      games_reviewed: unreviewedGameIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});