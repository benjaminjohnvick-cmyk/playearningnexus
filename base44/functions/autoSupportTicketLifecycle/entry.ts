import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const ticket = data;
    if (!ticket?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI auto-triage and reply
      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `You are GamerGain support AI. Triage this user support ticket:
Subject: "${ticket.subject || ticket.title || ''}"
Message: "${ticket.message || ticket.description || ''}"
Category: "${ticket.category || 'general'}"

Provide: auto_reply (2-3 sentences resolving or acknowledging), priority (low/medium/high/urgent), category_tag (billing/technical/survey/payout/account/other), can_auto_resolve (boolean).`,
        response_json_schema: {
          type: "object",
          properties: {
            auto_reply: { type: "string" },
            priority: { type: "string" },
            category_tag: { type: "string" },
            can_auto_resolve: { type: "boolean" }
          }
        }
      });

      const newStatus = triage.can_auto_resolve ? 'resolved' : 'open';

      await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
        priority: triage.priority,
        category: triage.category_tag,
        ai_response: triage.auto_reply,
        status: newStatus
      });

      // Email the user
      if (ticket.user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: ticket.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `📋 Support Ticket Received: ${ticket.subject || ticket.title}`,
            body: `Thank you for contacting GamerGain support!\n\n${triage.auto_reply}\n\nTicket Priority: ${triage.priority}\n\n${triage.can_auto_resolve ? 'Your issue has been automatically resolved.' : 'A team member will follow up if needed.'}`
          });
        }
      }

      // Alert admins for urgent
      if (triage.priority === 'urgent') {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of admins.slice(0, 2)) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: 'support_ticket_urgent',
            title: '🚨 Urgent Support Ticket',
            message: `Ticket: "${ticket.subject || ticket.title}" — ${ticket.user_id}`,
            is_read: false
          });
        }
      }
    }

    if (event?.type === 'update' && data.status === 'resolved') {
      if (ticket.user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: ticket.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `✅ Support Ticket Resolved`,
            body: `Your support ticket "${ticket.subject || ticket.title}" has been resolved.\n\n${ticket.resolution || ticket.ai_response || 'Your issue has been addressed.'}\n\nLet us know if you need further help!`
          });
        }
        await base44.asServiceRole.entities.Notification.create({
          user_id: ticket.user_id,
          type: 'support_resolved',
          title: '✅ Support Ticket Resolved',
          message: `Your ticket "${ticket.subject || ticket.title}" has been resolved!`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});