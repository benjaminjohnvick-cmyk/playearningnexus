import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const payout = data;
    if (!payout?.id) return Response.json({ ok: true });

    const recipientId = payout.user_id || payout.recipient_id;
    if (!recipientId) return Response.json({ ok: true });

    const user = (await base44.asServiceRole.entities.User.filter({ id: recipientId }))[0];

    if (event?.type === 'create') {
      // New payout queued
      if (payout.status === 'pending' && user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `💸 Payout of $${payout.amount} Queued`,
          body: `Your ${payout.payout_type || 'payout'} of $${payout.amount} via ${payout.method || 'PayPal'} has been queued and will be processed shortly.`
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = payout.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'completed') {
        if (user) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: recipientId,
            type: 'payout_completed',
            title: `💰 $${payout.amount} Payout Sent!`,
            message: `Your ${payout.payout_type || 'payout'} of $${payout.amount} has been sent via ${payout.method || 'PayPal'}!`,
            is_read: false
          });
          if (user.email) {
            await base44.integrations.Core.SendEmail({
              to: user.email,
              subject: `✅ $${payout.amount} Payout Completed!`,
              body: `Your ${payout.payout_type || 'payout'} of $${payout.amount} has been sent via ${payout.method || 'PayPal'}. Check your account — it should arrive within 1-3 business days.`
            });
          }
        }
      } else if (newStatus === 'failed') {
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `❌ Payout Failed — $${payout.amount}`,
            body: `Unfortunately your payout of $${payout.amount} failed. Reason: ${payout.error_message || 'Processing error'}. Please contact support to resolve this.`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});