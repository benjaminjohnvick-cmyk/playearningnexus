import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: transaction reconciliation, revenue distribution, developer payouts, daily tier checks
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Full reconciliation engine
    await base44.asServiceRole.functions.invoke('reconciliationEngine', {});
    results.reconciliation_run = true;

    // 2. PayPal reconciliation
    await base44.asServiceRole.functions.invoke('autoPayPalReconciliation', {});
    results.paypal_reconciled = true;

    // 3. Daily tier check for all users
    await base44.asServiceRole.functions.invoke('dailyTierCheck', {});
    results.tier_checks_run = true;

    // 4. Update user tiers
    await base44.asServiceRole.functions.invoke('updateUserTiers', {});
    results.user_tiers_updated = true;

    // 5. Process automated payouts
    await base44.asServiceRole.functions.invoke('processAutomatedPayouts', {});
    await base44.asServiceRole.functions.invoke('processScheduledPayouts', {});
    results.automated_payouts_processed = true;

    // 6. Calculate developer payouts
    const activeDevelopers = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'active' });
    let devPayoutsCalculated = 0;
    for (const dev of activeDevelopers.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('calculateDeveloperPayout', { developer_id: dev.id });
      devPayoutsCalculated++;
    }
    results.developer_payouts_calculated = devPayoutsCalculated;

    // 7. Check for failed transactions and retry
    const failedTx = await base44.asServiceRole.entities.Transaction.filter({ status: 'failed' }, '-created_date', 50);
    let retriedTx = 0;
    for (const tx of failedTx.slice(0, 10)) {
      const ageHours = (Date.now() - new Date(tx.created_date).getTime()) / 3600000;
      if (ageHours < 24) {
        await base44.asServiceRole.entities.Transaction.update(tx.id, { status: 'pending', retry_count: (tx.retry_count || 0) + 1 });
        retriedTx++;
      }
    }
    results.failed_transactions_retried = retriedTx;

    // 8. Earning velocity monitoring
    await base44.asServiceRole.functions.invoke('earningVelocityMonitor', {});
    results.earning_velocity_monitored = true;

    // 9. App store earnings validation
    await base44.asServiceRole.functions.invoke('appStoreEarningsValidator', {});
    results.app_store_earnings_validated = true;

    // 10. PPC grid subscription processing
    await base44.asServiceRole.functions.invoke('processPPCGridSubscription', {});
    results.ppc_subscriptions_processed = true;

    // 11. Charge install CPI for new installs
    await base44.asServiceRole.functions.invoke('chargeInstallCPI', {});
    results.install_cpis_charged = true;

    // 12. Revenue forecasting
    await base44.asServiceRole.functions.invoke('aiRevenueForecaster', {});
    results.revenue_forecast_updated = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});