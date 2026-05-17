import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-generates AI reviews for games that have no reviews yet
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    let reviewsGenerated = 0;

    for (const game of games) {
      const existingReviews = await base44.asServiceRole.entities.GameRating.filter({ game_id: game.id });
      if (existingReviews.length >= 3) continue; // Already has enough reviews

      const { InvokeLLM } = base44.asServiceRole.integrations.Core;

      // Generate 3 AI seed reviews per game
      const reviewsToGenerate = 3 - existingReviews.length;
      for (let i = 0; i < reviewsToGenerate; i++) {
        const review = await InvokeLLM({
          prompt: `Write a realistic, varied user review for this mobile game on a gaming rewards platform:
Game: ${game.title}
Category: ${game.category}
Description: ${game.description || 'A mobile game'}

Write a genuine-sounding short review (1-3 sentences) from a casual gamer perspective.
Vary sentiment naturally (mix of 4-5 star reviews).
Respond with JSON: { "rating": number (4 or 5), "review": "string", "would_recommend": true }`,
          response_json_schema: {
            type: 'object',
            properties: {
              rating: { type: 'number' },
              review: { type: 'string' },
              would_recommend: { type: 'boolean' },
            }
          }
        });

        await base44.asServiceRole.entities.GameRating.create({
          game_id: game.id,
          user_id: 'ai_generated',
          rating: review.rating,
          review: review.review,
          would_recommend: review.would_recommend,
        });
        reviewsGenerated++;
      }
    }

    return Response.json({ success: true, reviewsGenerated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});