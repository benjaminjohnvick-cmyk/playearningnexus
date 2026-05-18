import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const ticket = data;
    if (!ticket?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI classify and auto-respond to developer support
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are GamerGain developer support AI. A developer submitted a support ticket:
        Subject: "${ticket.subject}"
        Message: "${ticket.message || ticket.description || ''}"
        Category: "${ticket.category || 'general'}"
        
        Provide: auto_reply (2-3 sentence helpful response), priority (low/medium/high/urgent), 
        suggested_docs_link (string URL placeholder), estimated_hours (number).`,
        response_json_schema: {
          type: "object",
          properties: {
            auto_reply: { type: "string" },
            priority: { type: "string" },
            suggested_docs_link: { type: "string" },
            estimated_hours: { type: "number" }
          }
        }
      });

      await base44.asServiceRole.entities.DeveloperSupportTicket.update(ticket.id, {
        status: 'open',
        priority: aiResponse.priority,
        ai_auto_reply: aiResponse.auto_reply,
        estimated_resolution_hours: aiResponse.estimated_hours
      });

      // Find developer's contact email
      const devClient = ticket.developer_id
        ? (await base44.asServiceRole.entities.BusinessClient.filter({ id: ticket.developer_id }))[0]
        : null;
      if (devClient?.contact_email) {
        await base44.integrations.Core.SendEmail({
          to: devClient.contact_email,
          subject: `📋 Developer Support Ticket Received: ${ticket.subject}`,
          body: `${aiResponse.auto_reply}\n\nTicket ID: ${ticket.id}\nPriority: ${aiResponse.priority}\nEstimated resolution: ~${aiResponse.estimated_hours} hours`
        });
      }
    }

    if (event?.type === 'update' && data.status === 'resolved') {
      const devClient = ticket.developer_id
        ? (await base44.asServiceRole.entities.BusinessClient.filter({ id: ticket.developer_id }))[0]
        : null;
      if (devClient?.contact_email) {
        await base44.integrations.Core.SendEmail({
          to: devClient.contact_email,
          subject: `✅ Developer Support Resolved: ${ticket.subject}`,
          body: `Your support ticket "${ticket.subject}" has been resolved.\n\n${ticket.resolution || 'Our team has addressed your issue. Please let us know if you need further assistance.'}`
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});