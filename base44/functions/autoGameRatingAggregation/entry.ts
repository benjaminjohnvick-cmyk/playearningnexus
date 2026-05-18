import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const rating = data;
    if (!rating?.game_id) return Response.json({ ok: true });

    const allRatings = await base44.asServiceRole.entities.GameRating.filter({ game_id: rating.game_id });
    const total = allRatings.length;
    const avg = total > 0 ? allRatings.reduce((s, r) => s + (r.rating || 0), 0) / total : 0;

    await base44.asServiceRole.entities.Game.update(rating.game_id, {
      average_rating: parseFloat(avg.toFixed(2)),
      total_ratings: total
    });

    // Notify developer on milestone ratings
    if ([10, 50, 100, 500, 1000].includes(total)) {
      const game = (await base44.asServiceRole.entities.Game.filter({ id: rating.game_id }))[0];
      if (game?.developer_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: game.developer_id,
          type: 'game_rating_milestone',
          title: `⭐ "${game.title}" hit ${total} Ratings! Avg: ${avg.toFixed(1)}/5`,
          message: `Your game now has ${total} community ratings with an average of ${avg.toFixed(2)}/5 stars.`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, average_rating: avg, total_ratings: total });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});