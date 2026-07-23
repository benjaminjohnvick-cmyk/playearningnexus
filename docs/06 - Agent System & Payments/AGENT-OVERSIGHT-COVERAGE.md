# Agent Oversight — Critical Action Coverage Report

_Generated July 23, 2026. Maps every CRITICAL payout/fraud function from the coverage map to its oversight status._

**Summary:** 70 critical functions → **35 directly gated**, **7 covered transitively** (they call a gated money rail), **28 not gated** (read-only analysis, notifications, reconciliation, or inbound customer charges — they don't move money out).

## Directly gated (human approval required before execution)

- `aiPayoutFraudDetection`
- `aiPayoutSchedulerEngine`
- `autoAutomatedPaymentProcessor`
- `autoCreatorPayoutLifecycle`
- `autoFraudReportLifecycle`
- `autoFraudSecurityEngine`
- `autoMoneyTransferLifecycle`
- `autoPayoutRequestLifecycle`
- `autoRealTimeFraudResponse`
- `autoReferralCommissions`
- `autoReferralPayoutEngine`
- `autoTransferAndGiftEngine`
- `autoUXFraudEscalation`
- `autoWithdrawalApproval`
- `autoWithdrawalRequestLifecycle`
- `awardReferralJackpotEntries`
- `awardSocialMediaJackpotEntries`
- `calculateDeveloperPayout`
- `cashappPayout`
- `createSharedWalletGroup`
- `distributeTournamentPrizes`
- `joinSharedWalletGroup`
- `paypalPayout`
- `processAffiliatePayouts`
- `processAutomatedPayouts`
- `processReferralCommissions`
- `processScheduledPayouts`
- `processWithdrawalRequest`
- `requestManualPayout`
- `requestPayout`
- `scheduleAndProcessPayouts`
- `superAgentFinancePayouts`
- `venmoPayout`
- `verifyWithdrawalRequest`
- `weeklyContestWinner`

## Covered transitively (call a gated rail — the payout itself is gated per-item)

- `aiPayoutScheduler`
- `autoSmartReferralPayouts`
- `processMonthlyAffiliatePayouts`
- `processRewardPayout`
- `processWeeklyJackpot`
- `respondentMicroPayout`
- `smartPayoutScheduler`

## Intentionally NOT gated (no outbound money / no irreversible action)

_These analyze, score, notify, reconcile status, or take **inbound** customer payments (checkout). Gating them would create false approvals without adding safety. If you want any of these gated, add its name to `critical` in `risk-policy.json` and add the one-line gate block._

- `affiliateReferralFraudDetector`
- `aiFraudScorer`
- `aiPayoutAdvanceEngine`
- `aiPayoutInsight`
- `aiPayoutOptimizer`
- `autoABTestWinner`
- `autoCreatorPayoutOptimization`
- `autoMoneyTransferAIVetting`
- `autoPayPalReconciliation`
- `autoPayoutCompletionNotifier`
- `autoPayoutRecommendations`
- `autoPayoutStatusReconciliation`
- `autoUXFraudAnalysis`
- `banAppealScorer`
- `calculatePayoutWithFraudVetting`
- `capturePayPalSurveyOrder`
- `checkSurveyFraud`
- `confirmStripePayment`
- `createPayPalSurveyOrder`
- `createStripePaymentIntent`
- `fraudAlertNotifier`
- `fraudDetector`
- `fraudPayoutMonitor`
- `fraudScanEngine`
- `learnFraudPatternsAI`
- `realtimeFraudMonitor`
- `sendWithdrawalNotification`
- `surveyUXFraudAnalyzer`
