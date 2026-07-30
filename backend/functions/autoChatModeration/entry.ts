import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { moderateText } from "../../sdk/rules-first.ts";

// Auto-moderates chat messages and forum posts — rules first (free), AI only for the ambiguous middle.
export default __handler(async (req) => {
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

    // RULES FIRST (free): allow clearly-fine, delete clearly-bad, only 'review' reaches the AI.
    const pre = moderateText(content);
    if (pre.decision === 'allow') return Response.json({ ok: true, action: 'allow', via: 'rules' });
    if (pre.decision === 'block') {
      await base44.asServiceRole.entities.ChatMessage.update(messageId, {
        is_moderated: true, moderation_action: 'delete', moderation_reason: pre.reason, is_visible: false,
      }).catch(() => null);
      return Response.json({ ok: true, action: 'delete', via: 'rules' });
    }

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