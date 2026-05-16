import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Proactive Support Analyzer
 * Scheduled daily: scans open support tickets for patterns, generates AI responses
 * for unresolved tickets, and sends a pain-point digest to admins.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const openTickets = await base44.asServiceRole.entities.SupportTicket.filter({ status: 'open' });

    if (openTickets.length === 0) {
      return Response.json({ success: true, tickets_processed: 0 });
    }

    // Auto-respond to tickets that have no admin_notes yet
    let autoResponded = 0;
    for (const ticket of openTickets.slice(0, 20)) {
      if (ticket.admin_notes) continue; // already has a response

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a friendly support agent for GamerGain. Write a short, helpful first response to this ticket.

Category: ${ticket.category}
Subject: ${ticket.subject}
Description: ${(ticket.description || '').slice(0, 500)}

Respond in 2-3 sentences. Acknowledge the issue and tell them next steps or who is looking into it.
Return JSON: { "response": "string", "priority": "low|medium|high|urgent", "can_self_resolve": true|false }`,
        response_json_schema: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            priority: { type: 'string' },
            can_self_resolve: { type: 'boolean' }
          }
        }
      });

      await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
        admin_notes: `[AI Auto-Response]\n${aiResult.response}`,
        priority: aiResult.priority || ticket.priority,
        status: aiResult.can_self_resolve ? 'in_progress' : 'open',
      });
      autoResponded++;
    }

    // Generate pain-point digest for admins
    const ticketSummary = openTickets.slice(0, 50).map(t =>
      `[${t.category}] ${t.subject}: ${(t.description || '').slice(0, 150)}`
    ).join('\n');

    const digest = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze these ${openTickets.length} open GamerGain support tickets and identify top 3 pain points. Be concise.

${ticketSummary}

Return JSON: { "top_pain_points": ["string"], "most_urgent": "string", "recommended_fix": "string" }`,
      response_json_schema: {
        type: 'object',
        properties: {
          top_pain_points: { type: 'array', items: { type: 'string' } },
          most_urgent: { type: 'string' },
          recommended_fix: { type: 'string' }
        }
      }
    });

    // Notify admins
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins.slice(0, 3)) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        type: 'system',
        title: `🎫 Support Digest: ${openTickets.length} open tickets`,
        message: `Top issue: ${digest.most_urgent || digest.top_pain_points?.[0] || 'See support dashboard'}`,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/AdminDashboard',
        icon: 'alert-circle',
      });
    }

    return Response.json({
      success: true,
      open_tickets: openTickets.length,
      auto_responded: autoResponded,
      top_pain_points: digest.top_pain_points,
      most_urgent: digest.most_urgent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});