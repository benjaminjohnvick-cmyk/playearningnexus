import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 4: Financial & Payouts Automation
// Handles: Smart payout recommendations, automated processing, BNPL, reconciliation
Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Smart Payout Recommendations
  try {
    const eligibleUsers = await base44.asServiceRole.entities.User.list('-updated_date', 100);
    let recommendationsCreated = 0;
    for (const u of eligibleUsers.slice(0, 20)) {
      if ((u.total_earnings || 0) >= 10) {
        try {
          const existing = await base44.asServiceRole.entities.PayoutRecommendation.filter({
            user_id: u.id,
            status: 'pending'
          });
          if (!existing || existing.length === 0) {
            await invoke('aiPayoutInsight', { user_id: u.id });
            recommendationsCreated++;
          }
        } catch (e) {
          errors.push({ fn: 'payout_recommendation_user', error: e.message });
        }
      }
    }
    results.payout_recommendations_created = recommendationsCreated;
  } catch (e) {
    errors.push({ fn: 'payout_recommendations_fetch', error: e.message });
  }

  // 2. Automated Payout Processing
  await invoke('processScheduledPayouts');
  await invoke('processAutomatedPayouts');
  await invoke('smartPayoutScheduler');
  results.payouts_processed = true;

  // 3. Withdrawal Auto-Approval
  await invoke('autoWithdrawalApproval');
  results.withdrawals_processed = true;

  // 4. BNPL Family Member Requirement Calculation
  try {
    const bnplMembers = await base44.asServiceRole.entities.BNPLFamilyMember.filter({ status: 'active' });
    let bnplUpdates = 0;
    for (const member of bnplMembers.slice(0, 30)) {
      await invoke('calculateBNPLFamilyRequirement', { member_id: member.id });
      bnplUpdates++;
    }
    results.bnpl_updates = bnplUpdates;
  } catch (e) {
    errors.push({ fn: 'bnpl_fetch', error: e.message });
  }

  // 5. PayPal Reconciliation
  await invoke('autoPayPalReconciliation');
  await invoke('reconciliationEngine');
  results.reconciliation_run = true;

  // 6. Payout Fraud Detection
  await invoke('aiPayoutFraudDetection');
  await invoke('fraudPayoutMonitor');
  results.payout_fraud_checked = true;

  // 7. Payout Advance Engine
  await invoke('aiPayoutAdvanceEngine');
  results.payout_advances_evaluated = true;

  // 8. Developer Payout Calculation
  await invoke('calculateDeveloperPayout', { batch: true });
  await invoke('autoCreatorPayoutOptimization');
  results.developer_payouts_calculated = true;

  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_financial_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});