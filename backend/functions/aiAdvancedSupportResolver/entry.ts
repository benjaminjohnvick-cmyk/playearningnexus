import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch pending support tickets
    const tickets = await base44.entities.SupportTicket.filter(
      { status: 'open' },
      '-created_date',
      50
    );

    const resolutions = { auto_resolved: [], escalated: [] };

    for (const ticket of tickets) {
      // Generate AI resolution for complex issues
      const resolutionPrompt = `Resolve this support ticket:
Subject: ${ticket.subject}
Description: ${ticket.description}
Category: ${ticket.category}

Provide: 1) Root cause analysis, 2) Step-by-step solution, 3) Preventive measures, 4) Estimated resolution time.`;

      const aiResolution = await base44.integrations.Core.InvokeLLM({
        prompt: resolutionPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            root_cause: { type: 'string' },
            solution_steps: { type: 'array', items: { type: 'string' } },
            preventive_measures: { type: 'array', items: { type: 'string' } },
            resolution_time_minutes: { type: 'number' },
            can_auto_resolve: { type: 'boolean' }
          }
        }
      });

      // Auto-resolve straightforward issues
      if (aiResolution.can_auto_resolve) {
        const responseBody = `We've identified and resolved your issue:\n\n${aiResolution.solution_steps.join('\n')}\n\nFuture tips:\n${aiResolution.preventive_measures.join('\n')}`;
        
        await base44.entities.SupportTicket.update(ticket.id, {
          status: 'resolved',
          resolution_notes: responseBody
        });

        await base44.integrations.Core.SendEmail({
          to: ticket.user_email,
          subject: `Resolved: ${ticket.subject}`,
          body: responseBody
        });

        resolutions.auto_resolved.push(ticket.id);
      } else {
        // Escalate complex issues with AI summary
        resolutions.escalated.push({
          ticket_id: ticket.id,
          ai_analysis: aiResolution,
          priority: aiResolution.resolution_time_minutes > 30 ? 'high' : 'medium'
        });
      }
    }

    return Response.json({
      success: true,
      auto_resolved: resolutions.auto_resolved.length,
      escalated: resolutions.escalated.length,
      escalations: resolutions.escalated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});