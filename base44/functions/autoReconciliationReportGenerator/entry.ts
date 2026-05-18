import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Weekly: generate ReconciliationReport for financial and data consistency
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Gather financial data
    const [completedPayouts, pendingPayouts, transactions, orders] = await Promise.all([
      base44.asServiceRole.entities.Payout.filter({ status: 'completed' }),
      base44.asServiceRole.entities.Payout.filter({ status: 'pending' }),
      base44.asServiceRole.entities.Transaction.list('-created_date', 500),
      base44.asServiceRole.entities.Order.list('-created_date', 200)
    ]);

    const weeklyTransactions = transactions.filter(t => t.created_date >= weekAgo.toISOString());
    const weeklyOrders = orders.filter(o => o.created_date >= weekAgo.toISOString());

    const totalPayoutsCompleted = completedPayouts.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPendingPayouts = pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0);
    const totalRevenue = weeklyOrders.filter(o => o.funds_released).reduce((s, o) => s + (o.amount || 0), 0);
    const totalTransactionVolume = weeklyTransactions.reduce((s, t) => s + (t.amount || 0), 0);

    // AI analysis
    const aiAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate weekly financial reconciliation analysis:
Weekly metrics:
- Total transactions: ${weeklyTransactions.length} ($${totalTransactionVolume.toFixed(2)})
- Orders processed: ${weeklyOrders.length} ($${totalRevenue.toFixed(2)} released)
- Payouts completed (all time): ${completedPayouts.length} ($${totalPayoutsCompleted.toFixed(2)})
- Payouts pending: ${pendingPayouts.length} ($${totalPendingPayouts.toFixed(2)})

Identify: data_issues (array), financial_health (healthy/warning/critical), insights (array of 3), action_items (array of 2)`,
      response_json_schema: {
        type: 'object',
        properties: {
          data_issues: { type: 'array', items: { type: 'string' } },
          financial_health: { type: 'string' },
          insights: { type: 'array', items: { type: 'string' } },
          action_items: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    const report = await base44.asServiceRole.entities.ReconciliationReport.create({
      period_start: weekAgo.toISOString(),
      period_end: now.toISOString(),
      total_revenue: totalRevenue,
      total_payouts: totalPayoutsCompleted,
      pending_payouts: totalPendingPayouts,
      transaction_volume: totalTransactionVolume,
      financial_health: aiAnalysis.financial_health,
      data_issues: aiAnalysis.data_issues,
      insights: aiAnalysis.insights,
      action_items: aiAnalysis.action_items,
      status: 'generated',
      generated_at: now.toISOString()
    });

    if (aiAnalysis.financial_health !== 'healthy') {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'reconciliation_alert',
          title: `📊 Weekly Reconciliation [${aiAnalysis.financial_health.toUpperCase()}]`,
          message: `Issues: ${(aiAnalysis.data_issues || []).slice(0, 2).join('; ')}. Actions: ${(aiAnalysis.action_items || []).slice(0, 1).join('')}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, report_id: report.id, health: aiAnalysis.financial_health });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});