import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "requestPayout", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "requestPayout — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Business eligibility check
    const BUSINESS_ROLES = ['admin', 'developer', 'survey_creator', 'ppc_advertiser'];
    const { amount, payment_method, payment_details, payout_type } = await req.json();

    const isBusinessRole = BUSINESS_ROLES.includes(user.role);
    const isEligiblePayoutType = ['referral_commission', 'contest_win'].includes(payout_type);
    if (!isBusinessRole && !isEligiblePayoutType) {
      return Response.json({ error: 'Forbidden: You are not eligible for cash payouts.' }, { status: 403 });
    }

    if (!amount || amount < 5) return Response.json({ error: 'Minimum payout is $5' }, { status: 400 });
    if (!payment_method) return Response.json({ error: 'Missing payment method' }, { status: 400 });

    // Check available balance
    const availableBalance = user.total_earnings - (user.pending_payouts || 0);
    if (availableBalance < amount) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Get trust score
    const trustScores = await base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: user.id });
    const trustScore = trustScores[0]?.trust_score || 50;

    // Get earnings history (last 90 days)
    const events = await base44.asServiceRole.entities.UserJourneyEvent.filter({
      user_id: user.id,
      event_type: 'payout_completed',
    });
    const last90Days = events.filter(e => new Date(e.created_date) > new Date(Date.now() - 90 * 86400000));
    const earningsHistory = {
      total_payouts: last90Days.length,
      avg_payout_size: last90Days.length > 0 ? last90Days.reduce((sum, e) => sum + (e.amount || 0), 0) / last90Days.length : 0,
    };

    // Risk scoring
    const riskFactors = [];
    let riskScore = 0;

    if (trustScore < 40) { riskScore += 30; riskFactors.push('Low trust score'); }
    if (trustScore < 60 && amount > 500) { riskScore += 20; riskFactors.push('High amount + medium trust'); }
    if (user.account_age_days < 30) { riskScore += 25; riskFactors.push('New account'); }
    if (user.total_earnings < 50) { riskScore += 20; riskFactors.push('Low lifetime earnings'); }
    if (last90Days.length === 0) { riskScore += 15; riskFactors.push('No recent payout history'); }

    const passedSafetyChecks = riskScore < 50 && trustScore >= 40;

    // Create payout request
    const payoutRequest = await base44.asServiceRole.entities.PayoutRequest.create({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      amount,
      payment_method,
      payment_details,
      trust_score: trustScore,
      total_earnings: user.total_earnings,
      earnings_history: earningsHistory,
      risk_score: riskScore,
      risk_flags: riskFactors,
      passes_safety_checks: passedSafetyChecks,
      auto_approved: passedSafetyChecks,
      requested_at: new Date().toISOString(),
      status: passedSafetyChecks ? 'approved' : 'pending',
    });

    // If auto-approved, trigger payout webhook
    if (passedSafetyChecks) {
      const webhookPayload = {
        request_id: payoutRequest.id,
        user_id: user.id,
        user_email: user.email,
        amount,
        payment_method,
        payment_details,
        timestamp: new Date().toISOString(),
      };

      // Invoke payment processor webhook (stub for now)
      try {
        const webhookRes = await fetch(Deno.env.get('PAYOUT_WEBHOOK_URL') || 'https://api.example.com/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('PAYOUT_WEBHOOK_SECRET')}` },
          body: JSON.stringify(webhookPayload),
        });
        
        if (webhookRes.ok) {
          await base44.asServiceRole.entities.PayoutRequest.update(payoutRequest.id, {
            status: 'processing',
          });
        }
      } catch (err) {
        console.error('Webhook trigger failed:', err);
      }
    }

    return Response.json({
      success: true,
      request_id: payoutRequest.id,
      status: payoutRequest.status,
      auto_approved: passedSafetyChecks,
      trust_score: trustScore,
      risk_score: riskScore,
      risk_flags: riskFactors,
      next_steps: passedSafetyChecks
        ? 'Your payout is processing and will arrive within 1-2 business days.'
        : 'Your request is pending admin review. You\'ll receive an email within 24 hours.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});