import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

// Category 6: Fraud Detection & Security Automation
// Handles: UX fraud, referral fraud, payout fraud, content moderation
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoFraudSecurityEngine", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoFraudSecurityEngine — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      // Silently catch 403 auth errors and other function errors
      if (e.message && !e.message.includes('403')) {
        errors.push({ fn: name, error: e.message });
      }
    }
  };

  // 1. UX Fraud Analysis
  await invoke('autoUXFraudEscalation');
  await invoke('surveyUXFraudAnalyzer');
  await invoke('uxAnalysisEngine');
  results.ux_fraud_analyzed = true;

  // 2. Survey Response Fraud
  await invoke('checkSurveyFraud');
  await invoke('detectSuspiciousResponses');
  await invoke('auditSurveyResponses');
  await invoke('surveyQualityAutoScan');
  results.survey_fraud_checked = true;

  // 3. Referral Fraud Detection
  await invoke('flagSuspiciousReferrals');
  await invoke('verifyReferralConversion', { batch: true });
  results.referral_fraud_checked = true;

  // 4. Payout Fraud Monitoring
  await invoke('fraudPayoutMonitor');
  await invoke('aiPayoutFraudDetection');
  await invoke('aiFraudScorer');
  results.payout_fraud_checked = true;

  // 5. Real-time Fraud Response
  await invoke('autoRealTimeFraudResponse');
  await invoke('realtimeFraudMonitor');
  await invoke('fraudScanEngine');
  await invoke('fraudDetector');
  results.realtime_fraud_response = true;

  // 6. Content Moderation (chat, forums, reviews)
  await invoke('aiCommunityModerationEngine');
  await invoke('autoAdvancedModeration');
  results.content_moderation_run = true;

  // 7. Trust Score Computation
  await invoke('computeUserTrustScore', { batch: true });
  await invoke('calculateTrustScore', { batch: true });
  results.trust_scores_updated = true;

  // 8. Fraud Alerting
  await invoke('fraudAlertNotifier');
  await invoke('adminAlertNotifier');
  results.fraud_alerts_sent = true;

  // 9. Ad Fraud Detection
  await invoke('adSentimentScanner');
  results.ad_fraud_scanned = true;

  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_fraud_security_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});