import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch recent forum posts and chat messages
    const [posts, flaggedContent] = await Promise.all([
      base44.entities.ForumPost.filter({}, '-created_date', 100),
      base44.entities.FlaggedResponse.filter({}, '-created_date', 50)
    ]);

    const moderation = {
      auto_removed: [],
      warnings_issued: [],
      engagement_opportunities: []
    };

    // AI-powered content moderation
    for (const post of posts.slice(0, 20)) {
      const moderationPrompt = `Moderate this community post:
"${post.content.substring(0, 200)}"

Assess: 1) Safety (explicit, hate speech, spam), 2) Toxicity, 3) Community value, 4) Engagement potential.`;

      const moderationResult = await base44.integrations.Core.InvokeLLM({
        prompt: moderationPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            is_safe: { type: 'boolean' },
            toxicity_score: { type: 'number' },
            action: { type: 'string', enum: ['approve', 'warn', 'remove'] },
            engagement_boost: { type: 'boolean' }
          }
        }
      });

      if (!moderationResult.is_safe) {
        await base44.entities.ForumPost.update(post.id, { status: 'removed' });
        moderation.auto_removed.push(post.id);
      } else if (moderationResult.action === 'warn') {
        moderation.warnings_issued.push({ post_id: post.id, reason: 'toxicity' });
      } else if (moderationResult.engagement_boost) {
        moderation.engagement_opportunities.push(post.id);
      }
    }

    return Response.json({
      success: true,
      auto_removed: moderation.auto_removed.length,
      warnings: moderation.warnings_issued.length,
      engagement_opportunities: moderation.engagement_opportunities.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});