import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch pending payouts for approval
    const pendingPayouts = await base44.entities.Payout.filter(
      { status: 'pending_approval' },
      '-created_at',
      100
    );

    const approvals = { auto_approved: [], flagged_for_review: [] };

    for (const payout of pendingPayouts) {
      let approvalScore = 0;
      let riskFactors = [];

      // Scoring logic for auto-approval
      if (payout.fraud_analysis?.risk_level === 'low') {
        approvalScore += 40;
      } else if (payout.fraud_analysis?.risk_level === 'medium') {
        approvalScore += 20;
        riskFactors.push('medium_fraud_risk');
      } else {
        riskFactors.push('high_fraud_risk');
      }

      if (payout.net_payout < 100) {
        approvalScore += 30;
      } else if (payout.net_payout < 1000) {
        approvalScore += 20;
      } else if (payout.net_payout < 5000) {
        approvalScore += 10;
      }

      if (payout.fraud_analysis?.ai_recommendation === 'approve') {
        approvalScore += 30;
      }

      // Auto-approve low-risk, high-confidence payouts
      if (approvalScore >= 80 && payout.fraud_analysis?.risk_score <= 20) {
        await base44.entities.Payout.update(payout.id, {
          status: 'approved'
        });
        approvals.auto_approved.push({
          id: payout.id,
          reason: 'Low-risk payout auto-approved',
          score: approvalScore
        });
      } else {
        approvals.flagged_for_review.push({
          id: payout.id,
          score: approvalScore,
          risk_factors: riskFactors,
          risk_level: payout.fraud_analysis?.risk_level
        });
      }
    }

    return Response.json({
      success: true,
      auto_approved: approvals.auto_approved.length,
      needs_review: approvals.flagged_for_review.length,
      details: approvals
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});