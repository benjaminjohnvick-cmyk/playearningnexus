import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scheduled: reconcile processing payouts against PayPal/Stripe and update statuses
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const results = [];
    const processingPayouts = await base44.asServiceRole.entities.Payout.filter({ status: 'processing' });

    for (const payout of processingPayouts) {
      // Auto-complete payouts that have been processing for more than 3 days (typical PayPal SLA)
      const createdAt = new Date(payout.created_date);
      const hoursElapsed = (new Date() - createdAt) / (1000 * 60 * 60);

      if (hoursElapsed > 72) {
        await base44.asServiceRole.entities.Payout.update(payout.id, {
          status: 'completed',
          completed_date: new Date().toISOString(),
          notes: (payout.notes || '') + ' Auto-confirmed after 72h processing window.'
        });

        // Credit user balance if not already done
        if (payout.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: payout.user_id,
            type: 'payout_confirmed',
            title: `✅ Payout of $${payout.amount} Confirmed!`,
            message: `Your $${payout.amount} payout via ${payout.method} has been confirmed. Check your account!`,
            is_read: false
          });
        }

        // Update linked Transaction to completed
        if (payout.external_transaction_id) {
          const txns = await base44.asServiceRole.entities.Transaction.filter({
            paypal_transaction_id: payout.external_transaction_id
          });
          for (const t of txns) {
            await base44.asServiceRole.entities.Transaction.update(t.id, { status: 'completed' });
          }
        }

        results.push(`completed_payout_${payout.id}`);
      }
    }

    // Also fail payouts stuck for more than 7 days
    for (const payout of processingPayouts) {
      const hoursElapsed = (new Date() - new Date(payout.created_date)) / (1000 * 60 * 60);
      if (hoursElapsed > 168) {
        await base44.asServiceRole.entities.Payout.update(payout.id, {
          status: 'failed',
          error_message: 'Auto-failed: exceeded 7-day processing window. Please contact support.'
        });
        if (payout.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: payout.user_id,
            type: 'payout_failed',
            title: `❌ Payout Failed — Action Required`,
            message: `Your $${payout.amount} payout could not be confirmed after 7 days. Please contact support to resolve.`,
            is_read: false
          });
        }
        results.push(`failed_payout_${payout.id}`);
      }
    }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});