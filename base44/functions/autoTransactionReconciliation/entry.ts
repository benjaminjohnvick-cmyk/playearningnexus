import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: transaction reconciliation, revenue distribution, developer payouts, daily tier checks
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];
  const now = new Date().toISOString();

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Full reconciliation engine
  await invoke('reconciliationEngine');
  results.reconciliation_run = true;

  // 2. PayPal reconciliation
  await invoke('autoPayPalReconciliation');
  results.paypal_reconciled = true;

  // 3. Daily tier check for all users
  await invoke('dailyTierCheck');
  results.tier_checks_run = true;

  // 4. Update user tiers
  await invoke('updateUserTiers');
  results.user_tiers_updated = true;

  // 5. Process automated payouts
  await invoke('processAutomatedPayouts');
  await invoke('processScheduledPayouts');
  results.automated_payouts_processed = true;

  // 6. Calculate developer payouts
  try {
    const activeDevelopers = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'active' });
    let devPayoutsCalculated = 0;
    for (const dev of activeDevelopers.slice(0, 20)) {
      try {
        await base44.asServiceRole.functions.invoke('calculateDeveloperPayout', { developer_id: dev.id });
        devPayoutsCalculated++;
      } catch (e) {
        errors.push({ fn: 'calculateDeveloperPayout', id: dev.id, error: e.message });
      }
    }
    results.developer_payouts_calculated = devPayoutsCalculated;
  } catch (e) {
    errors.push({ fn: 'active_developers_fetch', error: e.message });
  }

  // 7. Check for failed transactions and retry
  try {
    const failedTx = await base44.asServiceRole.entities.Transaction.filter({ status: 'failed' }, '-created_date', 50);
    let retriedTx = 0;
    for (const tx of failedTx.slice(0, 10)) {
      try {
        const ageHours = (Date.now() - new Date(tx.created_date).getTime()) / 3600000;
        if (ageHours < 24) {
          await base44.asServiceRole.entities.Transaction.update(tx.id, { status: 'pending', retry_count: (tx.retry_count || 0) + 1 });
          retriedTx++;
        }
      } catch (e) {
        errors.push({ fn: 'transaction_retry', id: tx.id, error: e.message });
      }
    }
    results.failed_transactions_retried = retriedTx;
  } catch (e) {
    errors.push({ fn: 'failed_transactions_fetch', error: e.message });
  }

  // 8. Earning velocity monitoring
  await invoke('earningVelocityMonitor');
  results.earning_velocity_monitored = true;

  // 9. App store earnings validation
  await invoke('appStoreEarningsValidator');
  results.app_store_earnings_validated = true;

  // 10. PPC grid subscription processing
  await invoke('processPPCGridSubscription');
  results.ppc_subscriptions_processed = true;

  // 11. Charge install CPI for new installs
  await invoke('chargeInstallCPI');
  results.install_cpis_charged = true;

  // 12. Revenue forecasting
  await invoke('aiRevenueForecaster');
  results.revenue_forecast_updated = true;

  return Response.json({ success: true, results, errors });
});