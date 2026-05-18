import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const transfer = data;
    if (!transfer?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Notify recipient of pending transfer
      if (transfer.recipient_id) {
        const sender = transfer.sender_id ? (await base44.asServiceRole.entities.User.filter({ id: transfer.sender_id }))[0] : null;
        await base44.asServiceRole.entities.Notification.create({
          user_id: transfer.recipient_id,
          type: 'money_transfer_pending',
          title: `💸 Incoming Transfer: $${transfer.amount}`,
          message: `${sender?.full_name || 'Someone'} sent you $${transfer.amount}. It will be available after review.`,
          is_read: false
        });
      }
      // Confirm to sender
      if (transfer.sender_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: transfer.sender_id,
          type: 'money_transfer_sent',
          title: `💸 Transfer Initiated: $${transfer.amount}`,
          message: `Your transfer of $${transfer.amount} is being processed.`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = transfer.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'completed') {
        const recipient = transfer.recipient_id ? (await base44.asServiceRole.entities.User.filter({ id: transfer.recipient_id }))[0] : null;
        const sender = transfer.sender_id ? (await base44.asServiceRole.entities.User.filter({ id: transfer.sender_id }))[0] : null;

        if (recipient) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: transfer.recipient_id,
            type: 'money_transfer_received',
            title: `✅ $${transfer.amount} Received!`,
            message: `$${transfer.amount} from ${sender?.full_name || 'sender'} has been added to your balance.`,
            is_read: false
          });
          if (recipient.email) {
            await base44.integrations.Core.SendEmail({
              to: recipient.email,
              subject: `✅ $${transfer.amount} Transfer Received`,
              body: `${sender?.full_name || 'A GamerGain user'} sent you $${transfer.amount}. It has been added to your GamerGain balance.`
            });
          }
        }
        if (sender) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: transfer.sender_id,
            type: 'money_transfer_completed',
            title: `✅ Transfer Completed`,
            message: `Your $${transfer.amount} transfer to ${recipient?.full_name || 'recipient'} is complete.`,
            is_read: false
          });
        }
      }

      if (newStatus === 'failed' || newStatus === 'rejected') {
        if (transfer.sender_id) {
          const sender = (await base44.asServiceRole.entities.User.filter({ id: transfer.sender_id }))[0];
          await base44.asServiceRole.entities.Notification.create({
            user_id: transfer.sender_id,
            type: 'money_transfer_failed',
            title: `❌ Transfer Failed`,
            message: `Your $${transfer.amount} transfer could not be completed. ${transfer.failure_reason || 'Please try again.'}`,
            is_read: false
          });
          if (sender?.email) {
            await base44.integrations.Core.SendEmail({
              to: sender.email,
              subject: `❌ Transfer Failed — $${transfer.amount}`,
              body: `Your transfer of $${transfer.amount} failed. Reason: ${transfer.failure_reason || 'Processing error'}. Your funds have not been deducted.`
            });
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});