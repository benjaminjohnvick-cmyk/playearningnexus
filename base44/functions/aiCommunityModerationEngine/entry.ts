import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get recent user-generated content
    const forumPosts = await base44.asServiceRole.entities.ForumPost?.filter({}, '-created_date', 100) || [];
    const chatMessages = await base44.asServiceRole.entities.ChatMessage?.filter({}, '-created_date', 200) || [];
    const reviews = await base44.asServiceRole.entities.GameReview?.filter({}, '-created_date', 100) || [];

    const allContent = [
      ...forumPosts.map(p => ({ ...p, type: 'forum', id: p.id })),
      ...chatMessages.map(m => ({ ...m, type: 'chat', id: m.id })),
      ...reviews.map(r => ({ ...r, type: 'review', id: r.id }))
    ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 150);

    const moderationResults = [];

    for (const content of allContent) {
      const text = content.content || content.message || content.review_text || '';
      if (!text) continue;

      // AI content moderation
      const moderation = await base44.integrations.Core.InvokeLLM({
        prompt: `Moderate this user-generated content for safety and policy compliance:

Content Type: ${content.type}
Text: "${text.substring(0, 500)}"

Analyze for:
1. Offensive/toxic language: yes/no
2. Spam: yes/no
3. Harassment/bullying: yes/no
4. Adult content: yes/no
5. Misinformation: yes/no
6. Policy violations: yes/no

Provide a moderation action and reason.`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_safe: { type: 'boolean' },
            violations: { type: 'array', items: { type: 'string' } },
            action: { type: 'string', enum: ['approve', 'flag_review', 'remove', 'warn_user'] },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            reason: { type: 'string' }
          }
        }
      });

      moderationResults.push({
        content_id: content.id,
        content_type: content.type,
        author_id: content.user_id || content.author_id,
        is_safe: moderation.data.is_safe,
        action: moderation.data.action,
        severity: moderation.data.severity,
        violations: moderation.data.violations,
        reason: moderation.data.reason,
        reviewed_at: new Date().toISOString()
      });

      // Auto-action based on severity
      if (moderation.data.action === 'remove') {
        // In production, would delete or hide content
        console.log(`AUTO-REMOVING content ${content.id}: ${moderation.data.reason}`);
      }
    }

    // Summary statistics
    const unsafe = moderationResults.filter(r => !r.is_safe).length;
    const removed = moderationResults.filter(r => r.action === 'remove').length;
    const flagged = moderationResults.filter(r => r.action === 'flag_review').length;

    return Response.json({
      success: true,
      moderation_date: new Date().toISOString(),
      total_reviewed: moderationResults.length,
      unsafe_count: unsafe,
      removed_count: removed,
      flagged_for_review: flagged,
      moderation_results: moderationResults.filter(r => !r.is_safe),
      stats: {
        safety_rate: `${((moderationResults.length - unsafe) / moderationResults.length * 100).toFixed(1)}%`,
        removed_for_violations: removed,
        warnings_issued: moderationResults.filter(r => r.action === 'warn_user').length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});