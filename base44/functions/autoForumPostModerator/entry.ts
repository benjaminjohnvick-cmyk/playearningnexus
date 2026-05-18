import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const post = data;
    if (!post?.id || !post?.content) return Response.json({ ok: true });

    const modResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Moderate this gaming platform forum post:
Title: "${post.title || ''}"
Content: "${(post.content || '').substring(0, 500)}"

Assess: is_appropriate (true/false), severity (none/low/medium/high), reason (one sentence), suggested_action (approve/warn/flag/remove)`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_appropriate: { type: 'boolean' },
          severity: { type: 'string' },
          reason: { type: 'string' },
          suggested_action: { type: 'string' }
        }
      }
    });

    if (modResult.suggested_action === 'approve' || modResult.is_appropriate) {
      await base44.asServiceRole.entities.ForumPost.update(post.id, { status: 'approved', moderation_status: 'clean' });
    } else if (modResult.suggested_action === 'flag' || modResult.severity === 'medium') {
      await base44.asServiceRole.entities.ForumPost.update(post.id, { status: 'flagged', moderation_status: 'flagged', moderation_reason: modResult.reason });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 1)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'forum_flagged',
          title: `🚩 Forum Post Flagged for Review`,
          message: `Post by user ${post.user_id}: ${modResult.reason}`,
          is_read: false
        });
      }
    } else if (modResult.suggested_action === 'remove' || modResult.severity === 'high') {
      await base44.asServiceRole.entities.ForumPost.update(post.id, { status: 'removed', moderation_status: 'removed', moderation_reason: modResult.reason });
      await base44.asServiceRole.entities.Notification.create({
        user_id: post.user_id,
        type: 'post_removed',
        title: `Your Forum Post Was Removed`,
        message: `Your post was removed for violating community guidelines. Please review our posting rules.`,
        is_read: false
      });
    }

    return Response.json({ ok: true, action: modResult.suggested_action });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});