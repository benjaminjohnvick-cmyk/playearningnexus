import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const rating = data;
    if (!rating?.id || !rating?.game_id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Recalculate game average rating
      const allRatings = await base44.asServiceRole.entities.GameRating.filter({ game_id: rating.game_id });
      const avg = allRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / (allRatings.length || 1);
      await base44.asServiceRole.entities.Game.update(rating.game_id, {
        average_rating: parseFloat(avg.toFixed(2)),
        total_ratings: allRatings.length
      });

      // Notify game developer
      const game = (await base44.asServiceRole.entities.Game.filter({ id: rating.game_id }))[0];
      if (game?.developer_id) {
        const rater = rating.user_id ? (await base44.asServiceRole.entities.User.filter({ id: rating.user_id }))[0] : null;
        await base44.asServiceRole.entities.Notification.create({
          user_id: game.developer_id,
          type: 'game_rated',
          title: `⭐ New ${rating.rating}-Star Rating for "${game.title}"`,
          message: `${rater?.full_name || 'A player'} rated your game ${rating.rating}/5 stars.${rating.review ? ` Review: "${rating.review.substring(0, 80)}..."` : ''} New average: ${avg.toFixed(1)}/5`,
          is_read: false
        });
      }

      // Award XP to rater
      if (rating.user_id) {
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: rating.user_id,
          activity_type: 'game_rated',
          points_earned: rating.review ? 20 : 5,
          metadata: { game_id: rating.game_id, rating: rating.rating }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});