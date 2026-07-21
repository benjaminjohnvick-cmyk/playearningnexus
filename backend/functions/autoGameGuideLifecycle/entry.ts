import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const guide = data;
    if (!guide?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI moderate and score the guide
      const review = await base44.integrations.Core.InvokeLLM({
        prompt: `Review this game guide submission for a gaming platform:
Title: "${guide.title}"
Type: ${guide.guide_type}
Content preview: "${(guide.content || '').substring(0, 600)}"

Provide: approve (boolean), quality_score (0-100), rejection_reason (string or null), is_feature_worthy (boolean — score >= 85 and genuinely helpful).`,
        response_json_schema: {
          type: 'object',
          properties: {
            approve: { type: 'boolean' },
            quality_score: { type: 'number' },
            rejection_reason: { type: 'string' },
            is_feature_worthy: { type: 'boolean' }
          }
        }
      });

      const newStatus = review.approve ? 'approved' : 'rejected';
      await base44.asServiceRole.entities.GameGuide.update(guide.id, {
        status: newStatus,
        is_featured: review.is_feature_worthy && review.approve
      });

      if (guide.author_user_id) {
        if (review.approve) {
          // Award XP for approved guide
          await base44.asServiceRole.entities.UserActivity.create({
            user_id: guide.author_user_id,
            activity_type: 'guide_published',
            points_earned: review.is_feature_worthy ? 100 : 30,
            metadata: { guide_id: guide.id, game_id: guide.game_id }
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: guide.author_user_id,
            type: 'guide_approved',
            title: review.is_feature_worthy ? `⭐ Guide Featured: "${guide.title}"!` : `✅ Guide Approved: "${guide.title}"`,
            message: review.is_feature_worthy
              ? `Your guide was approved AND featured! You earned 100 XP.`
              : `Your guide "${guide.title}" was approved and is now live. You earned 30 XP!`,
            is_read: false
          });
        } else {
          await base44.asServiceRole.entities.Notification.create({
            user_id: guide.author_user_id,
            type: 'guide_rejected',
            title: `Guide Not Approved: "${guide.title}"`,
            message: `Your guide could not be approved. Reason: ${review.rejection_reason || 'Quality standards not met'}. You can edit and resubmit.`,
            is_read: false
          });
        }
      }

      // Notify game developer of new guide
      if (review.approve && guide.game_id) {
        const game = (await base44.asServiceRole.entities.Game.filter({ id: guide.game_id }))[0];
        if (game?.developer_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: game.developer_id,
            type: 'game_guide_published',
            title: `📖 New Guide Published for "${game.title}"`,
            message: `A community member published "${guide.title}" (${guide.guide_type}) for your game with a quality score of ${review.quality_score}/100.`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});