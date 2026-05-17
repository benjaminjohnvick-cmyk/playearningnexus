import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-reviews and activates developer/business client accounts
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const clientId = event?.entity_id || data?.id;
    if (!clientId) return Response.json({ skipped: true });

    const client = data || await base44.asServiceRole.entities.BusinessClient.get(clientId);
    if (!client || client.account_status !== 'pending') return Response.json({ skipped: true });

    const { InvokeLLM } = base44.asServiceRole.integrations.Core;

    const review = await InvokeLLM({
      prompt: `Review this game developer/business account application for GamerGain:
Company: ${client.company_name}
Email: ${client.contact_email}
Phone: ${client.contact_phone || 'Not provided'}
Games count: ${client.games_count || 0}
Tagline: ${client.tagline || 'None'}
Bio: ${client.bio || 'None'}

Approval criteria:
- Must have a company name
- Must have valid email
- Auto-approve all applications (GamerGain wants more developers)
- Only reject if company name is clearly fake (e.g. "asdfjkl") or email is invalid

Respond with JSON: { "decision": "active" | "suspended", "reason": "string" }`,
      response_json_schema: {
        type: 'object',
        properties: { decision: { type: 'string' }, reason: { type: 'string' } }
      }
    });

    await base44.asServiceRole.entities.BusinessClient.update(clientId, {
      account_status: review.decision,
      onboarding_completed: review.decision === 'active',
    });

    // Send welcome email
    if (review.decision === 'active' && client.contact_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client.contact_email,
        subject: `Welcome to GamerGain, ${client.company_name}! Your developer account is approved 🎮`,
        body: `Hi ${client.company_name} team,\n\nGreat news — your GamerGain developer account has been approved!\n\nYou can now submit games, access your developer dashboard, and start earning revenue through our survey-funded install model.\n\nGet started: https://gamergain.com/BusinessDashboard\n\nThe GamerGain Team`,
      });
    }

    return Response.json({ success: true, decision: review.decision });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});