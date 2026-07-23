import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

// Entity automation: triggered on PPCSurveyResponse create (completed=true)
// Calculates multi-tier referral commissions
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "processReferralCommissions", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "processReferralCommissions — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const body = await req.json();
    const response = body.data;

    if (!response?.completed || !response?.user_id || !response?.payout_to_user) {
      return Response.json({ skipped: true });
    }

    const earnerUserId = response.user_id;
    const earningAmount = response.payout_to_user || 0;

    if (earningAmount <= 0) return Response.json({ skipped: true });

    // Find referral chain: who referred this user?
    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: earnerUserId });
    if (referrals.length === 0) return Response.json({ no_referral: true });

    const tier1Referral = referrals[0];
    const tier1UserId = tier1Referral.referrer_user_id;

    // Tier commission rates
    const TIER1_RATE = 0.05; // 5% of earner's survey payout
    const TIER2_RATE = 0.02; // 2% from tier-2 referrer
    const TIER3_RATE = 0.01; // 1% from tier-3 referrer

    const commissions = [];

    // Tier 1 commission
    const tier1Amount = parseFloat((earningAmount * TIER1_RATE).toFixed(4));
    if (tier1Amount > 0) {
      commissions.push({ userId: tier1UserId, amount: tier1Amount, tier: 1 });

      // Check if tier-1 was also referred by someone (tier 2)
      const tier2Refs = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: tier1UserId });
      if (tier2Refs.length > 0) {
        const tier2UserId = tier2Refs[0].referrer_user_id;
        const tier2Amount = parseFloat((earningAmount * TIER2_RATE).toFixed(4));
        if (tier2Amount > 0) {
          commissions.push({ userId: tier2UserId, amount: tier2Amount, tier: 2 });

          // Tier 3
          const tier3Refs = await base44.asServiceRole.entities.Referral.filter({ referred_user_id: tier2UserId });
          if (tier3Refs.length > 0) {
            const tier3UserId = tier3Refs[0].referrer_user_id;
            const tier3Amount = parseFloat((earningAmount * TIER3_RATE).toFixed(4));
            if (tier3Amount > 0) {
              commissions.push({ userId: tier3UserId, amount: tier3Amount, tier: 3 });
            }
          }
        }
      }
    }

    // Apply commissions
    await Promise.all(commissions.map(async ({ userId, amount, tier }) => {
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (users.length === 0) return;
      const u = users[0];

      // Update user earnings
      await base44.asServiceRole.auth.updateUser(userId, {
        total_earnings: (u.total_earnings || 0) + amount,
        referral_earnings: (u.referral_earnings || 0) + amount,
      }).catch(() => {}); // may not exist on all user objects

      // Create transaction record
      await base44.asServiceRole.entities.PPCTransaction.create({
        user_id: userId,
        type: 'referral_commission',
        amount,
        description: `Tier-${tier} referral commission from survey completion`,
        status: 'completed',
        related_survey_id: response.survey_id,
      }).catch(() => {});

      // Notify
      await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        type: 'referral_earnings',
        title: `💸 Tier-${tier} Referral Earning`,
        message: `You earned $${amount.toFixed(4)} from a survey completed by your tier-${tier} referral.`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    }));

    return Response.json({ success: true, commissions_paid: commissions.length, commissions });
  } catch (error) {
    console.error('Referral commission error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});