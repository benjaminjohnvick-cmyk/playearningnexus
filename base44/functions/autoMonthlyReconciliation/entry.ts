import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const results = {};

    // 1. Reconcile all completed transactions for the month
    const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 500);
    const monthTransactions = transactions.filter(t => new Date(t.created_date) > monthAgo);
    const totalRevenue = monthTransactions.filter(t => t.transaction_type !== 'payout').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPayouts = monthTransactions.filter(t => t.transaction_type === 'payout').reduce((s, t) => s + (t.amount || 0), 0);
    results.month_transactions = monthTransactions.length;
    results.total_revenue = totalRevenue;
    results.total_payouts = totalPayouts;
    results.net = totalRevenue - totalPayouts;

    // 2. Calculate developer payouts for the month
    const completedOrders = await base44.asServiceRole.entities.Order.filter({ funds_released: true });
    const monthOrders = completedOrders.filter(o => new Date(o.created_date) > monthAgo);
    const devRevenueMap = {};
    for (const order of monthOrders) {
      if (order.vendor_name) {
        devRevenueMap[order.vendor_name] = (devRevenueMap[order.vendor_name] || 0) + (order.amount || 0) * 0.7;
      }
    }
    results.developer_payouts_owed = Object.keys(devRevenueMap).length;

    // 3. Flag any failed/stuck payouts older than 30 days
    const allPayouts = await base44.asServiceRole.entities.Payout.filter({ status: 'pending' });
    let stuckPayouts = 0;
    for (const payout of allPayouts) {
      const agedays = (now - new Date(payout.created_date)) / 86400000;
      if (agedays > 30) {
        await base44.asServiceRole.entities.Payout.update(payout.id, { status: 'failed', error_message: 'Auto-flagged: pending > 30 days' });
        stuckPayouts++;
      }
    }
    results.stuck_payouts_flagged = stuckPayouts;

    // 4. Store reconciliation report
    await base44.asServiceRole.entities.ReconciliationReport.create({
      period_start: monthAgo.toISOString().split('T')[0],
      period_end: now.toISOString().split('T')[0],
      total_transactions: monthTransactions.length,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_payouts: parseFloat(totalPayouts.toFixed(2)),
      net_revenue: parseFloat((totalRevenue - totalPayouts).toFixed(2)),
      status: 'completed',
      generated_at: now.toISOString()
    });

    // 5. Email admins the monthly summary
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      if (admin.email) {
        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `📊 Monthly Reconciliation Report — ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          body: `MONTHLY FINANCIAL RECONCILIATION\n\nPeriod: ${monthAgo.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}\n\nTotal Transactions: ${monthTransactions.length}\nTotal Revenue: $${totalRevenue.toFixed(2)}\nTotal Payouts: $${totalPayouts.toFixed(2)}\nNet Revenue: $${(totalRevenue - totalPayouts).toFixed(2)}\n\nDeveloper Payouts Owed: ${Object.keys(devRevenueMap).length} developers\nStuck Payouts Flagged: ${stuckPayouts}\n\nPlease review the Reconciliation dashboard for full details.`
        });
      }
    }

    return Response.json({ ok: true, ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});