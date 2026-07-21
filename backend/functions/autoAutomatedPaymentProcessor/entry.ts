import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: process AutomatedPayment records that are due
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = { processed: 0, failed: 0, skipped: 0 };

    const duePayments = await base44.asServiceRole.entities.AutomatedPayment.filter({ status: 'scheduled' });

    for (const payment of duePayments) {
      const dueAt = new Date(payment.due_date || payment.scheduled_at);
      if (dueAt > now) { results.skipped++; continue; }

      // Create Payout record
      const payout = await base44.asServiceRole.entities.Payout.create({
        user_id: payment.user_id,
        recipient_id: payment.recipient_id || payment.user_id,
        recipient_email: payment.recipient_email,
        amount: payment.amount,
        currency: payment.currency || 'USD',
        method: payment.payment_method || 'paypal',
        payout_type: payment.payment_type || 'manual',
        status: 'pending',
        description: payment.description || 'Automated payment',
        notes: `AutomatedPayment ID: ${payment.id}`
      });

      await base44.asServiceRole.entities.AutomatedPayment.update(payment.id, {
        status: 'processing',
        payout_id: payout.id,
        processed_at: now.toISOString()
      });

      // Notify recipient
      if (payment.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: payment.user_id,
          type: 'automated_payment',
          title: `💸 Automated Payment of $${payment.amount} Processing`,
          message: `Your scheduled payment of $${payment.amount} is being processed via ${payment.payment_method || 'PayPal'}.`,
          is_read: false
        });
      }

      results.processed++;
    }

    return Response.json({ ok: true, ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});