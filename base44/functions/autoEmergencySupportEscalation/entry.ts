import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get high-priority support tickets
    const tickets = await base44.asServiceRole.entities.SupportTicket.filter({
      priority: 'critical',
      status: 'pending'
    });

    const escalations = [];

    for (const ticket of tickets) {
      // Auto-escalate and auto-assign to senior support
      await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
        status: 'escalated_to_senior',
        assigned_to: 'senior_support_team',
        escalated_at: new Date().toISOString()
      });

      // Send urgent notification
      await base44.integrations.Core.SendEmail({
        to: 'support@gamergain.com',
        subject: `🚨 CRITICAL: Ticket ${ticket.id} - ${ticket.subject}`,
        body: `Critical support ticket requires immediate attention.\nUser: ${ticket.user_id}\nIssue: ${ticket.description}`
      });

      escalations.push(ticket.id);
    }

    return Response.json({ success: true, escalated: escalations.length, escalations });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});