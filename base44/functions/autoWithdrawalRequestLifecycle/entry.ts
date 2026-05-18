import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const wr = data;
    if (!wr?.id) return Response.json({ ok: true });

    const user = wr.user_id ? (await base44.asServiceRole.entities.User.filter({ id: wr.user_id }))[0] : null;

    if (event?.type === 'create') {
      // AI risk scoring
      const aiCheck = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess fraud risk for withdrawal: amount=$${wr.amount}, method=${wr.method}, user_id=${wr.user_id}. 
        Return: risk_score (0-100), risk_level (low/medium/high), auto_approve (boolean if amount<200 and risk<40), notes (string).`,
        response_json_schema: {
          type: "object",
          properties: {
            risk_score: { type: "number" },
            risk_level: { type: "string" },
            auto_approve: { type: "boolean" },
            notes: { type: "string" }
          }
        }
      });

      if (aiCheck.auto_approve && wr.amount <= 200) {
        await base44.asServiceRole.entities.WithdrawalRequest.update(wr.id, {
          status: 'approved',
          ai_risk_score: aiCheck.risk_score,
          ai_notes: aiCheck.notes
        });
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '✅ Withdrawal Request Approved',
            body: `Your withdrawal of $${wr.amount} via ${wr.method} has been approved automatically. Processing within 24 hours.`
          });
        }
      } else {
        await base44.asServiceRole.entities.WithdrawalRequest.update(wr.id, {
          status: 'under_review',
          ai_risk_score: aiCheck.risk_score,
          ai_risk_level: aiCheck.risk_level,
          ai_notes: aiCheck.notes
        });
      }

      // Always send confirmation
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '📋 Withdrawal Request Received',
          body: `We received your withdrawal request for $${wr.amount}. You will be notified once it's processed.`
        });
      }
    }

    if (event?.type === 'update' && wr.status === 'completed') {
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '🎉 Withdrawal Completed!',
          body: `Your withdrawal of $${wr.amount} via ${wr.method || 'PayPal'} has been completed successfully!`
        });
      }
      await base44.asServiceRole.entities.Notification.create({
        user_id: wr.user_id,
        type: 'withdrawal_completed',
        title: '💸 Withdrawal Complete',
        message: `$${wr.amount} sent via ${wr.method || 'PayPal'}!`,
        is_read: false
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});