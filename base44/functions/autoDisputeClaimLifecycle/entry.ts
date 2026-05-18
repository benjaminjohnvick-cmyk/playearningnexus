import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const claim = data;
    if (!claim?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      const user = claim.user_id ? (await base44.asServiceRole.entities.User.filter({ id: claim.user_id }))[0] : null;

      // AI analyze evidence
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this dispute claim on a gaming/survey earnings platform:
Type: ${claim.claim_type || 'general'}
Amount disputed: $${claim.amount || 0}
Description: "${claim.description || ''}"
Evidence provided: ${claim.evidence ? 'yes' : 'no'}

Provide: ai_verdict (approve/deny/escalate), confidence (0-100), reasoning (1 sentence), recommended_resolution (string).`,
        response_json_schema: {
          type: "object",
          properties: {
            ai_verdict: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            recommended_resolution: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.DisputeClaim.update(claim.id, {
        ai_verdict: analysis.ai_verdict,
        ai_confidence: analysis.confidence,
        ai_reasoning: analysis.reasoning,
        status: analysis.confidence >= 85 && analysis.ai_verdict !== 'escalate' ? analysis.ai_verdict === 'approve' ? 'approved' : 'denied' : 'under_review'
      });

      // Acknowledge to user
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `📋 Dispute Claim Received — #${claim.id.substring(0, 8)}`,
          body: `Your dispute claim has been received and is under review.\n\nClaim Type: ${claim.claim_type}\nAmount: $${claim.amount || 0}\n\nOur AI has reviewed your case. ${analysis.confidence >= 85 ? `Preliminary verdict: ${analysis.ai_verdict.toUpperCase()}. Reason: ${analysis.reasoning}` : 'A human reviewer will follow up within 24 hours.'}`
        });
      }

      if (user?.id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          type: 'dispute_claim_received',
          title: '📋 Dispute Claim Under Review',
          message: `Your claim for $${claim.amount || 0} is being reviewed. ${analysis.confidence >= 85 ? `AI preliminary verdict: ${analysis.ai_verdict}.` : 'Expect a response within 24 hours.'}`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update' && (data.status === 'approved' || data.status === 'denied')) {
      const user = claim.user_id ? (await base44.asServiceRole.entities.User.filter({ id: claim.user_id }))[0] : null;
      const approved = data.status === 'approved';

      if (approved && claim.amount && claim.user_id) {
        // Credit the disputed amount
        const currentUser = (await base44.asServiceRole.entities.User.filter({ id: claim.user_id }))[0];
        if (currentUser) {
          await base44.asServiceRole.entities.User.update(claim.user_id, {
            total_earnings: (currentUser.total_earnings || 0) + parseFloat(claim.amount)
          });
        }
      }

      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `${approved ? '✅' : '❌'} Dispute Claim ${approved ? 'Approved' : 'Denied'}`,
          body: `Your dispute claim has been ${data.status}.\n\n${approved ? `$${claim.amount} has been credited to your account.` : `Reason: ${claim.denial_reason || 'Does not meet dispute criteria.'}`}\n\nIf you have questions, contact our support team.`
        });
      }

      if (claim.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: claim.user_id,
          type: approved ? 'dispute_approved' : 'dispute_denied',
          title: approved ? `✅ Dispute Approved — $${claim.amount} Credited` : `❌ Dispute Denied`,
          message: approved ? `Your dispute for $${claim.amount} was approved and credited to your account.` : `Your dispute was reviewed and denied. ${claim.denial_reason || ''}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});