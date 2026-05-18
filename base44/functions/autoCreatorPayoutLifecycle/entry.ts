import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const payout = data;
    if (!payout?.id) return Response.json({ ok: true });

    const creator = payout.creator_id ? (await base44.asServiceRole.entities.User.filter({ id: payout.creator_id }))[0] : null;

    if (event?.type === 'create') {
      if (creator?.email) {
        await base44.integrations.Core.SendEmail({
          to: creator.email,
          subject: `💰 Creator Payout of $${payout.amount} Initiated`,
          body: `Your creator earnings payout of $${payout.amount} has been initiated via ${payout.payment_method || 'PayPal'}. Processing time: 1-3 business days.`
        });
      }
      if (payout.creator_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: payout.creator_id,
          type: 'creator_payout_initiated',
          title: `💰 Creator Payout Initiated: $${payout.amount}`,
          message: `Your earnings payout of $${payout.amount} is being processed.`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = payout.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'completed') {
        if (creator?.email) {
          await base44.integrations.Core.SendEmail({
            to: creator.email,
            subject: `✅ Creator Payout Sent: $${payout.amount}`,
            body: `Your creator payout of $${payout.amount} has been sent to your ${payout.payment_method || 'PayPal'} account. Transaction ID: ${payout.transaction_id || 'N/A'}`
          });
        }
        if (payout.creator_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: payout.creator_id,
            type: 'creator_payout_completed',
            title: `✅ Creator Payout Sent: $${payout.amount}!`,
            message: `$${payout.amount} has been sent to your account. Check your ${payout.payment_method || 'PayPal'}.`,
            is_read: false
          });
        }
      }

      if (newStatus === 'failed') {
        if (creator?.email) {
          await base44.integrations.Core.SendEmail({
            to: creator.email,
            subject: `❌ Creator Payout Failed: $${payout.amount}`,
            body: `Your creator payout of $${payout.amount} failed. Reason: ${payout.failure_reason || 'Processing error'}. Please verify your payment details and contact support.`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});