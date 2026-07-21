import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Auto-resolves disputes using AI, escalates only clear fraud
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const disputeId = event?.entity_id || data?.id;
    if (!disputeId) return Response.json({ skipped: true });

    const dispute = data || await base44.asServiceRole.entities.SurveyDispute.get(disputeId);
    if (!dispute || dispute.status !== 'open') return Response.json({ skipped: true });

    const { InvokeLLM } = base44.asServiceRole.integrations.Core;

    const result = await InvokeLLM({
      prompt: `You are an automated dispute resolution agent for GamerGain, a survey rewards platform.

Analyze this dispute and make a resolution decision:
- Type: ${dispute.dispute_type || 'survey_payment'}
- User claim: ${dispute.user_claim || dispute.description || 'Payment not received'}
- Amount disputed: $${dispute.amount || 0}
- Evidence notes: ${dispute.evidence_notes || 'None provided'}
- User trust context: Standard user

Resolution rules:
- If amount < $5: auto-approve and pay out (low risk, high retention value)
- If amount $5-$20: auto-approve if claim is plausible (survey payment not received is very common)
- If amount > $20 or evidence of fraud: escalate to admin
- Always err on the side of the user for survey payment disputes

Respond with JSON: { "decision": "approved" | "rejected" | "escalated", "reason": "string", "payout_amount": number }`,
      response_json_schema: {
        type: 'object',
        properties: {
          decision: { type: 'string' },
          reason: { type: 'string' },
          payout_amount: { type: 'number' }
        }
      }
    });

    await base44.asServiceRole.entities.SurveyDispute.update(disputeId, {
      status: result.decision === 'escalated' ? 'escalated' : result.decision,
      resolution_notes: result.reason,
      resolved_at: new Date().toISOString(),
      ai_resolved: true,
    });

    // Auto-pay if approved
    if (result.decision === 'approved' && result.payout_amount > 0 && dispute.user_id) {
      await base44.asServiceRole.entities.Payout.create({
        user_id: dispute.user_id,
        amount: result.payout_amount,
        method: 'balance_credit',
        payout_type: 'manual',
        status: 'completed',
        description: `Auto-resolved dispute: ${result.reason}`,
        completed_date: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, decision: result.decision });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});