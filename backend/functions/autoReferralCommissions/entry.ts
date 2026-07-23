import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoReferralCommissions", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoReferralCommissions — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const payload = await req.json();
    const { event, data } = payload;

    const referralId = event?.entity_id || data?.id;
    if (!referralId) return Response.json({ skipped: true });

    const referral = data || await base44.asServiceRole.entities.Referral.get(referralId);
    if (!referral) return Response.json({ skipped: true });

    const prevEarnings = referral.last_tracked_earning || 0;
    const currentEarnings = referral.ppc_bitlabs_earnings || 0;
    if (currentEarnings <= prevEarnings) return Response.json({ skipped: 'no new earnings' });

    const diff = currentEarnings - prevEarnings;
    const commission = diff * 0.05; // 5% commission on new earnings

    // Award commission to level 1 referrer
    if (referral.level_1_referrer_id) {
      const l1Node = await base44.asServiceRole.entities.MLMNode.filter({ user_id: referral.level_1_referrer_id });
      if (l1Node.length > 0) {
        await base44.asServiceRole.entities.MLMNode.update(l1Node[0].id, {
          website_credit_balance: (l1Node[0].website_credit_balance || 0) + commission,
          total_mlm_bonuses_received: (l1Node[0].total_mlm_bonuses_received || 0) + commission
        });
      }
    }

    // Update referral tracking
    await base44.asServiceRole.entities.Referral.update(referralId, {
      last_tracked_earning: currentEarnings,
      commission_earned: (referral.commission_earned || 0) + commission
    });

    // Activate referral if still pending
    if (referral.status === 'pending' && currentEarnings > 0) {
      await base44.asServiceRole.entities.Referral.update(referralId, { status: 'active' });
    }

    return Response.json({ success: true, commission_awarded: commission });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});