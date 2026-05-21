import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { ticket_id, action } = body;

    if (!action) return Response.json({ error: 'Missing action parameter (submit|get_analysis|list)' }, { status: 400 });

    if (action === 'submit') {
      // Create a new dispute ticket
      const { subject, description, category, evidence_urls, affected_amount } = body;
      const ticket = await base44.asServiceRole.entities.DeveloperSupportTicket.create({
        user_id: user.id,
        subject: subject || 'Developer Dispute',
        description,
        category: category || 'billing',
        status: 'open',
        priority: affected_amount > 500 ? 'high' : affected_amount > 100 ? 'medium' : 'low',
        evidence_urls: evidence_urls || [],
        affected_amount: affected_amount || 0,
        ai_analysis_status: 'pending',
      });

      // Immediately trigger AI analysis
      const transactions = await base44.asServiceRole.entities.Transaction.filter({ user_id: user.id }, '-created_date', 100);
      const payouts = await base44.asServiceRole.entities.Payout.filter({ user_id: user.id }, '-created_date', 50);
      const businessClients = await base44.asServiceRole.entities.BusinessClient.filter({ owner_user_id: user.id });
      const businessClient = businessClients[0];

      const prompt = `You are an AI dispute resolution agent for GamerGain platform. A developer has submitted a dispute ticket. Analyze all available evidence and propose a fair resolution.

DISPUTE DETAILS:
- Ticket ID: ${ticket.id}
- Category: ${category}
- Subject: ${subject}
- Developer Description: ${description}
- Affected Amount: $${affected_amount || 0}
- Priority: ${affected_amount > 500 ? 'HIGH' : 'MEDIUM'}

DEVELOPER PROFILE:
- Account Status: ${businessClient?.account_status || 'unknown'}
- Total Revenue: $${businessClient?.total_revenue || 0}
- Games Count: ${businessClient?.games_count || 0}
- Account Created: ${businessClient?.created_date || 'unknown'}

RECENT TRANSACTIONS (last 10):
${JSON.stringify(transactions.slice(0, 10).map(t => ({ type: t.transaction_type, amount: t.amount, status: t.status, date: t.created_date, notes: t.notes })), null, 2)}

RECENT PAYOUTS (last 5):
${JSON.stringify(payouts.slice(0, 5).map(p => ({ amount: p.amount, status: p.status, method: p.method, date: p.created_date })), null, 2)}

Analyze this dispute thoroughly and provide:
1. Likelihood of developer's claim being valid (0-100)
2. Root cause analysis
3. Proposed resolution with specific dollar amounts if applicable
4. Whether admin intervention is needed
5. Timeline for resolution

Return JSON:
{
  "validity_score": number,
  "root_cause": "string",
  "resolution_type": "approve_full|approve_partial|deny|escalate|needs_more_info",
  "resolution_amount": number,
  "resolution_explanation": "string",
  "admin_action_required": boolean,
  "admin_instructions": "string",
  "estimated_resolution_days": number,
  "risk_flag": boolean,
  "risk_reason": "string",
  "resolution_steps": ["string"],
  "precedent_note": "string"
}`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            validity_score: { type: 'number' },
            root_cause: { type: 'string' },
            resolution_type: { type: 'string' },
            resolution_amount: { type: 'number' },
            resolution_explanation: { type: 'string' },
            admin_action_required: { type: 'boolean' },
            admin_instructions: { type: 'string' },
            estimated_resolution_days: { type: 'number' },
            risk_flag: { type: 'boolean' },
            risk_reason: { type: 'string' },
            resolution_steps: { type: 'array', items: { type: 'string' } },
            precedent_note: { type: 'string' }
          }
        }
      });

      // Update ticket with AI analysis
      await base44.asServiceRole.entities.DeveloperSupportTicket.update(ticket.id, {
        ai_analysis: aiAnalysis,
        ai_analysis_status: 'completed',
        status: aiAnalysis.admin_action_required ? 'in_progress' : 'in_progress',
        priority: aiAnalysis.risk_flag ? 'urgent' : undefined,
      });

      // Send email notification
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `🎮 Dispute Ticket #${ticket.id.slice(-6).toUpperCase()} — AI Analysis Complete`,
        body: `Hi ${user.full_name},\n\nYour dispute ticket has been analyzed by our AI resolution system.\n\nValidity Score: ${aiAnalysis.validity_score}/100\nResolution Type: ${aiAnalysis.resolution_type}\nEstimated Resolution: ${aiAnalysis.estimated_resolution_days} business days\n\nAI Findings: ${aiAnalysis.resolution_explanation}\n\nNext Steps:\n${(aiAnalysis.resolution_steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n— GamerGain Support`,
        from_name: 'GamerGain Support',
      }).catch(() => null);

      return Response.json({ success: true, ticket_id: ticket.id, ai_analysis: aiAnalysis });
    }

    if (action === 'get_analysis' && ticket_id) {
      const tickets = await base44.asServiceRole.entities.DeveloperSupportTicket.filter({ id: ticket_id });
      const ticket = tickets[0];
      if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });
      return Response.json({ success: true, ticket });
    }

    if (action === 'list') {
      const tickets = await base44.asServiceRole.entities.DeveloperSupportTicket.filter(
        { user_id: user.id }, '-created_date', 50
      );
      return Response.json({ success: true, tickets });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('aiDisputeResolver error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});