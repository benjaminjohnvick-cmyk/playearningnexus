import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoRealTimeFraudResponse", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoRealTimeFraudResponse — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const { fraud_score, user_id, activity_type } = await req.json();

    if (!fraud_score || !user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actions = [];

    // Auto-respond based on fraud confidence
    if (fraud_score > 0.95) {
      // Critical: Immediate lockout
      await base44.asServiceRole.entities.LockoutSession.create({
        user_id,
        reason: 'critical_fraud_detected',
        lockout_type: 'temporary',
        duration_minutes: 24 * 60
      });
      actions.push('lockout_temporary');

      // Alert admin
      await base44.integrations.Core.SendEmail({
        to: 'fraud@gamergain.com',
        subject: '🚨 CRITICAL FRAUD: Immediate Lockout',
        body: `User ${user_id} has been locked out due to critical fraud score: ${fraud_score}`
      });
    } else if (fraud_score > 0.85) {
      // High: Require verification
      await base44.asServiceRole.entities.SupportTicket.create({
        user_id,
        category: 'fraud_verification',
        subject: 'Please Verify Your Account',
        status: 'pending_user_response',
        priority: 'high',
        ai_generated: true
      });
      actions.push('require_verification');
    } else if (fraud_score > 0.70) {
      // Medium: Monitor & flag
      await base44.asServiceRole.entities.FraudReport.create({
        user_id,
        fraud_score,
        activity_type,
        status: 'monitoring',
        ai_flagged: true
      });
      actions.push('monitoring_enabled');
    }

    return Response.json({ success: true, actions, fraud_score });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});