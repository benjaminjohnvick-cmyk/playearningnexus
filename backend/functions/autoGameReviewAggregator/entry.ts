import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (!['create', 'update'].includes(event?.type)) return Response.json({ ok: true });
    const review = data;
    if (!review?.game_id) return Response.json({ ok: true });

    const allReviews = await base44.asServiceRole.entities.GameReview.filter({ game_id: review.game_id });
    const total = allReviews.length;
    const avg = total > 0 ? allReviews.reduce((s, r) => s + (r.rating || 0), 0) / total : 0;

    await base44.asServiceRole.entities.Game.update(review.game_id, {
      average_rating: parseFloat(avg.toFixed(2)),
      total_ratings: total
    });

    // Notify developer at milestones
    if ([5, 25, 100].includes(total)) {
      const game = (await base44.asServiceRole.entities.Game.filter({ id: review.game_id }))[0];
      if (game?.developer_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: game.developer_id,
          type: 'review_milestone',
          title: `⭐ "${game.title}" Has ${total} Reviews! Avg: ${avg.toFixed(1)}/5`,
          message: `Keep engaging with your players to maintain a high rating!`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, avg, total });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});