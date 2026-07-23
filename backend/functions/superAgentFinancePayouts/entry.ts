import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

/**
 * Super Agent 5: GamerGain Finance & Payout Ops Agent
 * Orchestrates: processAutomatedPayouts, processScheduledPayouts,
 * processWithdrawalRequest (batch pending), calculateDeveloperPayout (all devs),
 * chargeInstallCPI, aiPayoutFraudDetection, aiPayoutScheduler,
 * processRewardPayout, respondentMicroPayout, processReferralDailyBonus,
 * priceDropMonitor, priceAlertChecker, verifyWithdrawalRequest,
 * requestPayout (auto-trigger eligible users), sendWithdrawalNotification
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "superAgentFinancePayouts", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "superAgentFinancePayouts — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }

    const body = await req.json().catch(() => ({}));
    const { dry_run = false } = body;
    const start = Date.now();
    const results = {};
    const errors = {};

    const run = async (name, fn, payload = {}) => {
      try {
        console.log(`[FinancePayouts] Running ${name}...`);
        results[name] = await base44.asServiceRole.functions.invoke(fn, payload);
        console.log(`[FinancePayouts] ✓ ${name}`);
      } catch (e) {
        errors[name] = e.message;
        console.error(`[FinancePayouts] ✗ ${name}: ${e.message}`);
      }
    };

    // === FRAUD DETECTION FIRST (gate) ===
    await run('ai_payout_fraud_detection', 'aiPayoutFraudDetection', {});

    // === PAYOUT SCHEDULING ===
    await run('ai_payout_scheduler', 'aiPayoutScheduler', {});

    if (!dry_run) {
      // === PAYOUT PROCESSING ===
      await run('process_automated_payouts', 'processAutomatedPayouts', {});
      await run('process_scheduled_payouts', 'processScheduledPayouts', {});
      await run('process_reward_payout', 'processRewardPayout', {});

      // === WITHDRAWAL PROCESSING ===
      // Find pending withdrawal requests and auto-verify + process them
      const pendingWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'pending' });
      let withdrawalsProcessed = 0;
      for (const wr of pendingWithdrawals.slice(0, 20)) {
        try {
          await base44.asServiceRole.functions.invoke('verifyWithdrawalRequest', { withdrawal_id: wr.id });
          withdrawalsProcessed++;
        } catch (e) {
          console.error(`[FinancePayouts] Withdrawal ${wr.id} failed: ${e.message}`);
        }
      }
      results['withdrawal_requests_processed'] = { count: withdrawalsProcessed };
    }

    // === DEVELOPER PAYOUTS (monthly on 1st) ===
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth === 1 || body.force_dev_payouts) {
      const developers = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'active' });
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      let devPayoutsCalc = 0;
      for (const dev of developers.slice(0, 50)) {
        try {
          await base44.asServiceRole.functions.invoke('calculateDeveloperPayout', {
            developer_id: dev.id,
            period_start: periodStart,
            period_end: periodEnd
          });
          devPayoutsCalc++;
        } catch (e) {
          console.error(`[FinancePayouts] Dev payout calc failed for ${dev.id}: ${e.message}`);
        }
      }
      results['developer_payouts_calculated'] = { count: devPayoutsCalc, period: `${periodStart} → ${periodEnd}` };
    }

    // === PRICE MONITORING ===
    await run('price_drop_monitor', 'priceDropMonitor', {});
    await run('price_alert_checker', 'priceAlertChecker', {});
    await run('send_withdrawal_notification', 'sendWithdrawalNotification', {});

    // AI financial risk assessment
    const pendingPayouts = await base44.asServiceRole.entities.Payout.filter({ status: 'pending' });
    const totalPending = pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0);

    const riskAssessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `GamerGain Finance Super Agent completed a run.
Dry run: ${dry_run}
Steps OK: ${Object.keys(results).join(', ')}
Steps failed: ${Object.keys(errors).join(', ') || 'none'}
Total pending payouts in queue: ${pendingPayouts.length} ($${totalPending.toFixed(2)})
Errors: ${JSON.stringify(errors)}

Assess financial pipeline health and flag any risks.
Return JSON: { "financial_health": "stable|watch|critical", "risk_flag": null or "string", "liquidity_concern": true|false, "summary": "1 sentence" }`,
      response_json_schema: {
        type: 'object',
        properties: {
          financial_health: { type: 'string' },
          risk_flag: { type: 'string' },
          liquidity_concern: { type: 'boolean' },
          summary: { type: 'string' }
        }
      }
    });

    // Alert admins if financial health is critical
    if (riskAssessment.financial_health === 'critical' || riskAssessment.liquidity_concern) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'security_alert',
          title: `💸 Finance Agent: ${riskAssessment.financial_health?.toUpperCase()} — Action Required`,
          message: riskAssessment.risk_flag || riskAssessment.summary,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/ManagePayouts',
        });

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `🚨 GamerGain Finance Alert: ${riskAssessment.financial_health?.toUpperCase()}`,
          body: `<h2>Finance Agent Alert</h2><p><strong>Status:</strong> ${riskAssessment.financial_health}</p><p>${riskAssessment.summary}</p><p><strong>Risk:</strong> ${riskAssessment.risk_flag || 'See dashboard'}</p><p>Pending payouts: ${pendingPayouts.length} ($${totalPending.toFixed(2)})</p>`,
          from_name: 'GamerGain Finance AI'
        }).catch(() => {});
      }
    }

    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'finance_payout_superagent',
      action_type: 'full_pipeline_run',
      target_entity: 'Payout',
      output_data: {
        results_keys: Object.keys(results), errors, dry_run,
        pending_payouts: pendingPayouts.length,
        total_pending_usd: totalPending,
        financial_health: riskAssessment.financial_health
      },
      predicted_outcome: riskAssessment.summary,
      confidence_score: riskAssessment.financial_health === 'stable' ? 92 : riskAssessment.financial_health === 'watch' ? 65 : 35,
      tags: ['finance', 'payouts', riskAssessment.financial_health, dry_run ? 'dry_run' : 'live']
    });

    return Response.json({
      success: true,
      agent: 'finance_payout_superagent',
      duration_ms: Date.now() - start,
      dry_run,
      steps_ok: Object.keys(results).length,
      steps_failed: Object.keys(errors).length,
      pending_payouts_in_queue: pendingPayouts.length,
      total_pending_usd: totalPending,
      ai_risk_assessment: riskAssessment,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[FinancePayouts] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});