import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const game = data;
    if (!game?.id || game?.status !== 'pending') return Response.json({ ok: true });

    const review = await base44.integrations.Core.InvokeLLM({
      prompt: `Review this mobile game submission for a gaming rewards platform:
Title: "${game.title}"
Description: "${(game.description || '').substring(0, 400)}"
Category: ${game.category}
Platform: ${(game.platform || []).join(', ')}
Price: $${game.price || 0}
Has download URL: ${!!game.download_url}
Has icon: ${!!game.icon_url}

Evaluate: recommend_action (approve/reject/request_more_info), quality_score (0-100), issues (array), notes (one sentence)`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommend_action: { type: 'string' },
          quality_score: { type: 'number' },
          issues: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' }
        }
      }
    });

    // Queue position for approved games
    const approvedGames = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    const queuePos = approvedGames.length + 1;

    if (review.recommend_action === 'approve' && review.quality_score >= 60) {
      await base44.asServiceRole.entities.Game.update(game.id, {
        status: 'approved',
        queue_position: queuePos,
        marketplace_approved: true,
        ai_vetting_notes: review.notes
      });
      if (game.developer_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: game.developer_id,
          type: 'game_approved',
          title: `✅ "${game.title}" Approved! Queue Position: #${queuePos}`,
          message: `${review.notes} Your game will be featured when it reaches the front of the queue.`,
          is_read: false
        });
      }
    } else if (review.recommend_action === 'reject') {
      await base44.asServiceRole.entities.Game.update(game.id, {
        status: 'rejected',
        ai_vetting_notes: review.notes
      });
      if (game.developer_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: game.developer_id,
          type: 'game_rejected',
          title: `❌ "${game.title}" Needs Work`,
          message: `Issues: ${(review.issues || []).join(', ')}. ${review.notes}`,
          is_read: false
        });
      }
    } else {
      // Flag for admin review
      await base44.asServiceRole.entities.Game.update(game.id, { ai_vetting_notes: `Needs review: ${review.notes}` });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 1)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'game_review_needed',
          title: `🎮 Game Needs Manual Review: "${game.title}"`,
          message: `AI score: ${review.quality_score}/100. ${review.notes}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, action: review.recommend_action, score: review.quality_score });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});