import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { classifyByKeywords } from "../../sdk/rules-first.ts";

// Free keyword routing for the obvious tickets; the AI is reserved for the ambiguous ones.
const TICKET_CATEGORIES = {
  billing: ["refund", "charge", "payment", "invoice", "paypal", "card", "subscription", "billed", "money", "payout", "withdraw"],
  technical: ["error", "bug", "crash", "broken", "not working", "loading", "login", "password", "glitch", "freeze", "fails"],
  feature_request: ["feature", "suggestion", "would like", "please add", "request", "idea", "wish"],
  complaint: ["complaint", "unhappy", "terrible", "worst", "scam", "angry", "disappointed", "unfair"],
};
const TEAM_FOR = { billing: "billing", technical: "technical", feature_request: "product", complaint: "support", other: "support" };

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
        // RULES FIRST (free): route by an obvious keyword. Only unclear tickets fall back to the AI.
        const cls = classifyByKeywords(`${ticket.subject || ''} ${ticket.description || ''}`, TICKET_CATEGORIES);
        if (cls.category && cls.confidence >= 0.5) {
          await base44.entities.SupportTicket.update(ticket.id, {
            category: cls.category,
            priority: cls.category === 'complaint' ? 'high' : 'medium',
            assigned_team: TEAM_FOR[cls.category] || 'support',
            status: 'assigned',
          }).catch(() => null);
          triaged++;
          results.push({ ticket_id: ticket.id, category: cls.category, via: 'rules' });
          continue;
        }

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