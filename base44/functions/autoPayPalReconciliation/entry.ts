import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const accounts = await base44.asServiceRole.entities.PayPalAccount.list();
    let reconciled = 0;

    for (const account of accounts) {
      if (!account.paypal_email) continue;

      // Calculate totals from internal records
      const completedPayouts = await base44.asServiceRole.entities.Payout.filter({ status: 'completed', method: 'paypal' });
      const totalPaidOut = completedPayouts.reduce((s, p) => s + (p.amount || 0), 0);

      const completedTransactions = await base44.asServiceRole.entities.Transaction.filter({ status: 'completed' });
      const totalReceived = completedTransactions
        .filter(t => ['survey_earning', 'install_fee', 'priority_payment', 'revenue_share'].includes(t.transaction_type))
        .reduce((s, t) => s + (t.amount || 0), 0);

      await base44.asServiceRole.entities.PayPalAccount.update(account.id, {
        total_paid_out: totalPaidOut,
        total_received: totalReceived,
        balance: totalReceived - totalPaidOut,
        last_sync_date: new Date().toISOString()
      });
      reconciled++;
    }

    return Response.json({ success: true, reconciled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});