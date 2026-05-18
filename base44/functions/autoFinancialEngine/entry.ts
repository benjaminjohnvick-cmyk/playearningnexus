import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 4: Financial & Payouts Automation
// Handles: Smart payout recommendations, automated processing, BNPL, reconciliation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Smart Payout Recommendations
    const eligibleUsers = await base44.asServiceRole.entities.User.list('-updated_date', 100);
    let recommendationsCreated = 0;
    for (const u of eligibleUsers.slice(0, 20)) {
      if ((u.total_earnings || 0) >= 10) {
        const existing = await base44.asServiceRole.entities.PayoutRecommendation.filter({
          user_id: u.id,
          status: 'pending'
        });
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.functions.invoke('aiPayoutInsight', { user_id: u.id });
          recommendationsCreated++;
        }
      }
    }
    results.payout_recommendations_created = recommendationsCreated;

    // 2. Automated Payout Processing
    await base44.asServiceRole.functions.invoke('processScheduledPayouts', {});
    await base44.asServiceRole.functions.invoke('processAutomatedPayouts', {});
    await base44.asServiceRole.functions.invoke('smartPayoutScheduler', {});
    results.payouts_processed = true;

    // 3. Withdrawal Auto-Approval (non-fraud-flagged)
    await base44.asServiceRole.functions.invoke('autoWithdrawalApproval', {});
    results.withdrawals_processed = true;

    // 4. BNPL Family Member Requirement Calculation
    const bnplMembers = await base44.asServiceRole.entities.BNPLFamilyMember.filter({ status: 'active' });
    let bnplUpdates = 0;
    for (const member of bnplMembers.slice(0, 30)) {
      await base44.asServiceRole.functions.invoke('calculateBNPLFamilyRequirement', { member_id: member.id });
      bnplUpdates++;
    }
    results.bnpl_updates = bnplUpdates;

    // 5. PayPal Reconciliation
    await base44.asServiceRole.functions.invoke('autoPayPalReconciliation', {});
    await base44.asServiceRole.functions.invoke('reconciliationEngine', {});
    results.reconciliation_run = true;

    // 6. Payout Fraud Detection
    await base44.asServiceRole.functions.invoke('aiPayoutFraudDetection', {});
    await base44.asServiceRole.functions.invoke('fraudPayoutMonitor', {});
    results.payout_fraud_checked = true;

    // 7. Payout Advance Engine (for eligible users)
    await base44.asServiceRole.functions.invoke('aiPayoutAdvanceEngine', {});
    results.payout_advances_evaluated = true;

    // 8. Developer Payout Calculation
    await base44.asServiceRole.functions.invoke('calculateDeveloperPayout', { batch: true });
    await base44.asServiceRole.functions.invoke('autoCreatorPayoutOptimization', {});
    results.developer_payouts_calculated = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action: 'auto_financial_engine_run',
      details: JSON.stringify(results),
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});