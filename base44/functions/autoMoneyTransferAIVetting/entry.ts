import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const transfer = data;
    if (!transfer?.id) return Response.json({ ok: true });

    // Get sender history
    const senderTransfers = await base44.asServiceRole.entities.MoneyTransfer.filter({ sender_id: transfer.sender_id });
    const totalSent = senderTransfers.reduce((s, t) => s + (t.amount || 0), 0);

    const verdict = await base44.integrations.Core.InvokeLLM({
      prompt: `Vet this money transfer for fraud:
Amount: $${transfer.amount}
Sender's historical total sent: $${totalSent}
Transfer type: ${transfer.transfer_type || 'unknown'}
Is first transfer: ${senderTransfers.length <= 1}
Amount is > $100: ${transfer.amount > 100}

Risk level (low/medium/high), auto_approve (true/false for low risk <= $50 first-time or proven senders), reason (one sentence)`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string' },
          auto_approve: { type: 'boolean' },
          reason: { type: 'string' }
        }
      }
    });

    if (verdict.auto_approve && verdict.risk_level === 'low') {
      await base44.asServiceRole.entities.MoneyTransfer.update(transfer.id, {
        status: 'approved',
        vetting_status: 'auto_approved',
        vetting_reason: verdict.reason
      });
    } else if (verdict.risk_level === 'high') {
      await base44.asServiceRole.entities.MoneyTransfer.update(transfer.id, {
        status: 'flagged',
        vetting_status: 'flagged',
        vetting_reason: verdict.reason
      });
      await base44.asServiceRole.entities.FraudReport.create({
        user_id: transfer.sender_id,
        report_type: 'suspicious_transfer',
        details: `Transfer of $${transfer.amount}: ${verdict.reason}`,
        status: 'open'
      });
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'fraud_alert',
          title: `🚨 High-Risk Transfer Flagged: $${transfer.amount}`,
          message: verdict.reason,
          is_read: false
        });
      }
    } else {
      await base44.asServiceRole.entities.MoneyTransfer.update(transfer.id, {
        vetting_status: 'pending_review',
        vetting_reason: verdict.reason
      });
    }

    return Response.json({ ok: true, risk_level: verdict.risk_level });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});