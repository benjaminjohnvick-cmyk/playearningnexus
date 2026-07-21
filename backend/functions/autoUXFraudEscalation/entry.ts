import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const session = data;
    if (!session?.id || event?.type !== 'update') return Response.json({ ok: true });

    const oldStatus = old_data?.fraud_analysis_status;
    const newStatus = data.fraud_analysis_status;
    if (oldStatus === newStatus) return Response.json({ ok: true });

    if (newStatus === 'flagged' || newStatus === 'escalated') {
      // Create SupportTicket for admin review
      const ticket = await base44.asServiceRole.entities.SupportTicket.create({
        user_id: session.user_id,
        subject: `UX Fraud Alert: Session ${session.session_id}`,
        message: `Fraud analysis flagged session ${session.session_id}.\nFraud Score: ${session.fraud_score}/100\nSignals: ${(session.fraud_signals || []).join(', ')}\nAI Verdict: ${session.ai_verdict || 'pending'}\nAI Confidence: ${((session.ai_confidence || 0) * 100).toFixed(0)}%`,
        category: 'fraud',
        priority: newStatus === 'escalated' ? 'high' : 'medium',
        status: 'open',
        source: 'auto_fraud_detection'
      });

      // Update session with ticket reference
      await base44.asServiceRole.entities.UXSessionRecording.update(session.id, {
        escalated_to_admin: true,
        admin_ticket_id: ticket.id
      });

      // Notify admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'fraud_escalation',
          title: `🚨 UX Fraud ${newStatus === 'escalated' ? 'ESCALATED' : 'Flagged'}: Score ${session.fraud_score}/100`,
          message: `Session ${session.session_id} flagged. Signals: ${(session.fraud_signals || []).slice(0, 3).join(', ')}. Ticket #${ticket.id} created.`,
          is_read: false
        });
      }

      // If high fraud score, also flag the survey response linked to this session
      if ((session.fraud_score || 0) >= 80 && session.response_id) {
        await base44.asServiceRole.entities.PPCSurveyResponse.update(session.response_id, {
          fraud_flag: true,
          fraud_reason: `High fraud score (${session.fraud_score}) from UX session analysis`,
          status: 'flagged'
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});