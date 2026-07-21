import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const post = data;
    if (!post?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI moderate content
      const mod = await base44.integrations.Core.InvokeLLM({
        prompt: `Moderate this gaming forum post. Check for spam, hate speech, explicit content, scams.
Title: "${post.title}"
Content: "${(post.content || '').substring(0, 500)}"
Category: "${post.category}"
Respond: is_flagged (boolean), reason (string or null), severity (low/medium/high).`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_flagged: { type: 'boolean' },
            reason: { type: 'string' },
            severity: { type: 'string' }
          }
        }
      });

      if (mod.is_flagged && mod.severity === 'high') {
        await base44.asServiceRole.entities.ForumPost.update(post.id, { is_locked: true });
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 2)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'forum_post_flagged',
            title: '🚨 Forum Post Flagged',
            message: `"${post.title}" flagged for: ${mod.reason}`,
            is_read: false
          });
        }
      }

      // If this is a reply, notify the original post author
      if (post.parent_post_id && post.author_user_id) {
        const parent = (await base44.asServiceRole.entities.ForumPost.filter({ id: post.parent_post_id }))[0];
        if (parent && parent.author_user_id && parent.author_user_id !== post.author_user_id) {
          const replier = (await base44.asServiceRole.entities.User.filter({ id: post.author_user_id }))[0];
          await base44.asServiceRole.entities.Notification.create({
            user_id: parent.author_user_id,
            type: 'forum_reply',
            title: `💬 New Reply on "${parent.title}"`,
            message: `${replier?.full_name || 'Someone'} replied to your forum post: "${(post.content || '').substring(0, 100)}"`,
            is_read: false
          });
          // Update reply count on parent
          await base44.asServiceRole.entities.ForumPost.update(post.parent_post_id, {
            replies_count: (parent.replies_count || 0) + 1
          });
        }
      }

      // Award XP for posting
      if (post.author_user_id) {
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: post.author_user_id,
          activity_type: post.parent_post_id ? 'forum_reply' : 'forum_post',
          points_earned: post.parent_post_id ? 5 : 15,
          metadata: { post_id: post.id }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});