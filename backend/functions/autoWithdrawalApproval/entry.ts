import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

// Auto-approves or denies withdrawal requests using AI fraud scoring
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoWithdrawalApproval", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoWithdrawalApproval — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const payload = await req.json();
    const { event, data } = payload;

    const requestId = event?.entity_id || data?.id;
    if (!requestId) return Response.json({ skipped: true });

    const request = data || await base44.asServiceRole.entities.WithdrawalRequest.get(requestId);
    if (!request || request.status !== 'pending') return Response.json({ skipped: true });

    const user = request.user_id
      ? (await base44.asServiceRole.entities.User.filter({ id: request.user_id }))[0]
      : null;

    // Fast auto-approve: small amounts from users with clean history
    const amount = request.amount || 0;
    const userEarnings = user?.total_earnings || 0;

    if (amount <= 10 && userEarnings >= amount) {
      await base44.asServiceRole.entities.WithdrawalRequest.update(requestId, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        review_notes: 'Auto-approved: low amount, sufficient balance',
      });
      await base44.asServiceRole.functions.invoke('processWithdrawalRequest', { withdrawal_id: requestId });
      return Response.json({ success: true, action: 'auto_approved' });
    }

    // AI risk assessment for larger amounts
    const { InvokeLLM } = base44.asServiceRole.integrations.Core;
    const risk = await InvokeLLM({
      prompt: `Assess withdrawal request risk for a gaming rewards platform:
Amount requested: $${amount}
User total earnings: $${userEarnings}
Account age: ${user?.created_date ? Math.floor((Date.now() - new Date(user.created_date)) / (1000 * 60 * 60 * 24)) : 0} days
Payment method: ${request.method || 'paypal'}

Is this withdrawal legitimate? 
Rules: Approve if amount <= user earnings, account > 7 days old, method is valid.
Reject if amount > earnings, or account < 3 days old.
Escalate if > $100 or unusual pattern.

Respond with JSON: { "decision": "approved" | "rejected" | "escalated", "reason": "string" }`,
      response_json_schema: {
        type: 'object',
        properties: { decision: { type: 'string' }, reason: { type: 'string' } }
      }
    });

    await base44.asServiceRole.entities.WithdrawalRequest.update(requestId, {
      status: risk.decision,
      reviewed_at: new Date().toISOString(),
      review_notes: risk.reason,
    });

    if (risk.decision === 'approved') {
      await base44.asServiceRole.functions.invoke('processWithdrawalRequest', { withdrawal_id: requestId });
    }

    return Response.json({ success: true, action: risk.decision });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});