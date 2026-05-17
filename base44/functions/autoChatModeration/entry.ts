import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-moderates chat messages and forum posts using AI
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const messageId = event?.entity_id || data?.id;
    if (!messageId) return Response.json({ skipped: true });

    const message = data || await base44.asServiceRole.entities.ChatMessage.get(messageId);
    if (!message || message.is_moderated) return Response.json({ skipped: true });

    const content = message.content || message.message || '';
    if (!content || content.length < 3) return Response.json({ skipped: true });

    const { InvokeLLM } = base44.asServiceRole.integrations.Core;

    const moderation = await InvokeLLM({
      prompt: `Moderate this chat message for a gaming rewards platform. Check for:
- Spam or promotional content
- Hate speech, harassment, profanity
- Scam attempts or phishing
- Excessive caps or symbols

Message: "${content}"

Respond with JSON: { "action": "allow" | "flag" | "delete", "reason": "string" }`,
      response_json_schema: {
        type: 'object',
        properties: { action: { type: 'string' }, reason: { type: 'string' } }
      }
    });

    if (moderation.action !== 'allow') {
      await base44.asServiceRole.entities.ChatMessage.update(messageId, {
        is_moderated: true,
        moderation_action: moderation.action,
        moderation_reason: moderation.reason,
        is_visible: moderation.action !== 'delete',
      });
    } else {
      await base44.asServiceRole.entities.ChatMessage.update(messageId, { is_moderated: true });
    }

    return Response.json({ success: true, action: moderation.action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});