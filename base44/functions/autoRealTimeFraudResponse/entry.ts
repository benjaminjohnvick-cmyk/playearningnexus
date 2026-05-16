import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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