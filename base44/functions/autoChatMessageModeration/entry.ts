import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const msg = data;
    if (!msg?.id || event?.type !== 'create') return Response.json({ ok: true });
    if (!msg.content || msg.content.length < 3) return Response.json({ ok: true });

    // AI moderation check
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Moderate this chat message for a gaming platform. Check for: spam, hate speech, explicit content, scams, personal info sharing.
Message: "${msg.content}"
Respond with: is_flagged (boolean), reason (string or null), severity (low/medium/high or null).`,
      response_json_schema: {
        type: "object",
        properties: {
          is_flagged: { type: "boolean" },
          reason: { type: "string" },
          severity: { type: "string" }
        }
      }
    });

    if (result.is_flagged) {
      await base44.asServiceRole.entities.ChatMessage.update(msg.id, {
        is_flagged: true,
        flag_reason: result.reason,
        is_visible: result.severity === 'high' ? false : true
      });

      if (result.severity === 'high') {
        // Alert admins for high severity
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 2)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'chat_flagged',
            title: '🚨 High-Severity Chat Message Flagged',
            message: `Message from user ${msg.user_id}: "${msg.content?.substring(0, 80)}..." — Reason: ${result.reason}`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true, flagged: result.is_flagged });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});