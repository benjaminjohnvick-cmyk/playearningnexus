import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

const TIER_COMMISSIONS = {
  starter: 0.10,
  growth: 0.15,
  pro: 0.20,
  gold: 0.22,
  platinum: 0.25,
};

const PAYOUT_THRESHOLDS = {
  starter: 25,
  growth: 20,
  pro: 15,
  gold: 10,
  platinum: 10,
};

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "processAffiliatePayouts", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "processAffiliatePayouts — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'calculate';

    if (action === 'calculate') {
      // Get all affiliates with referrals
      const referrals = await base44.asServiceRole.entities.Referral.list('-created_date', 500);
      const onboardings = await base44.asServiceRole.entities.AffiliateOnboarding.list('-created_date', 200);

      const tierMap = {};
      for (const o of onboardings) {
        tierMap[o.affiliate_user_id] = o.assigned_tier || 'starter';
      }

      // Group referrals by affiliate
      const byAffiliate = {};
      for (const r of referrals) {
        if (!r.referrer_user_id) continue;
        if (!byAffiliate[r.referrer_user_id]) byAffiliate[r.referrer_user_id] = [];
        byAffiliate[r.referrer_user_id].push(r);
      }

      const queued = [];
      for (const [affiliateId, refs] of Object.entries(byAffiliate)) {
        const tier = tierMap[affiliateId] || 'starter';
        const commPct = TIER_COMMISSIONS[tier] || 0.10;
        const threshold = PAYOUT_THRESHOLDS[tier] || 25;

        const converted = refs.filter(r => r.status === 'converted');
        const grossEarnings = converted.reduce((sum, r) => sum + (r.reward_amount || 1.00), 0) * commPct;

        if (grossEarnings >= threshold) {
          // Check if pending payout already exists
          const existing = await base44.asServiceRole.entities.PayoutRequest.filter({
            affiliate_user_id: affiliateId,
            status: 'pending_validation',
          });

          if (existing.length === 0) {
            const payout = await base44.asServiceRole.entities.PayoutRequest.create({
              affiliate_user_id: affiliateId,
              affiliate_email: refs[0]?.referrer_email || '',
              payout_month: new Date().toISOString().slice(0, 7),
              gross_earnings: grossEarnings,
              referral_count: refs.length,
              conversion_count: converted.length,
              conversion_rate: refs.length > 0 ? converted.length / refs.length : 0,
              net_payout_amount: grossEarnings,
              status: 'pending_validation',
              processing_notes: `Auto-queued: ${tier} tier (${(commPct * 100).toFixed(0)}% commission)`,
            });
            queued.push(payout);
          }
        }
      }

      return Response.json({ success: true, queued: queued.length, message: `${queued.length} payouts queued` });
    }

    if (action === 'approve') {
      const { payout_id } = body;
      await base44.asServiceRole.entities.PayoutRequest.update(payout_id, {
        status: 'pending_payment',
        processing_notes: `Approved by admin on ${new Date().toISOString()}`,
      });
      return Response.json({ success: true, message: 'Payout approved' });
    }

    if (action === 'reject') {
      const { payout_id, reason } = body;
      await base44.asServiceRole.entities.PayoutRequest.update(payout_id, {
        status: 'cancelled',
        processing_notes: `Rejected by admin: ${reason || 'No reason provided'}`,
      });
      return Response.json({ success: true, message: 'Payout rejected' });
    }

    if (action === 'notify') {
      const { payout_id } = body;
      const payout = await base44.asServiceRole.entities.PayoutRequest.get(payout_id);
      if (payout && payout.affiliate_email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: payout.affiliate_email,
          subject: '💰 Your GamerGain Affiliate Payout Has Been Processed',
          body: `
Hi there,

Great news! Your affiliate payout of $${payout.net_payout_amount?.toFixed(2)} has been processed.

Payout Details:
- Month: ${payout.payout_month}
- Gross Earnings: $${payout.gross_earnings?.toFixed(2)}
- Net Payout: $${payout.net_payout_amount?.toFixed(2)}
- Referrals: ${payout.referral_count}
- Conversions: ${payout.conversion_count}

Payment will arrive via ${payout.payment_method || 'your selected method'} within 3–5 business days.

Keep up the great work!
— GamerGain Team
          `.trim(),
        });
      }
      return Response.json({ success: true, message: 'Notification sent' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});