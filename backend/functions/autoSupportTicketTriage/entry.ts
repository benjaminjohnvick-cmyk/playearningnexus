import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch unassigned support tickets
    const tickets = await base44.entities.SupportTicket.filter({
      status: 'open',
      assigned_to: null
    }, '-created_date', 100);

    let triaged = 0;
    const results = [];

    for (const ticket of tickets) {
      try {
        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Triage this support ticket and assign optimal category and priority.

Ticket Subject: ${ticket.subject}
Description: ${ticket.description}
User Type: ${ticket.user_type || 'user'}

Return JSON with:
1. category: "billing", "technical", "feature_request", "complaint", "other"
2. priority: "critical", "high", "medium", "low"
3. suggested_team: "support", "technical", "billing", "product"
4. resolution_time_estimate_hours: estimated hours to resolve
5. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              priority: { type: 'string' },
              suggested_team: { type: 'string' },
              resolution_time_estimate_hours: { type: 'number' },
              confidence: { type: 'number' }
            }
          }
        });

        if (analysis.confidence >= 80) {
          await base44.entities.SupportTicket.update(ticket.id, {
            category: analysis.category,
            priority: analysis.priority,
            assigned_team: analysis.suggested_team,
            status: 'assigned'
          });
          triaged++;
        }

        results.push({
          ticket_id: ticket.id,
          subject: ticket.subject,
          category: analysis.category,
          priority: analysis.priority,
          team: analysis.suggested_team,
          confidence: analysis.confidence,
          assigned: analysis.confidence >= 80,
          awaiting_review: analysis.confidence < 80 && analysis.confidence >= 70
        });
      } catch (error) {
        console.error(`Triage failed for ticket ${ticket.id}:`, error);
      }
    }

    return Response.json({
      tickets_analyzed: tickets.length,
      tickets_triaged: triaged,
      awaiting_review: results.filter(r => r.awaiting_review).length,
      results: results.slice(0, 30)
    });
  } catch (error) {
    console.error('Support triage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});