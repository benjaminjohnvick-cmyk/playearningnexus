import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoReferralPayoutEngine", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoReferralPayoutEngine — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    if (event?.type !== 'update') return Response.json({ ok: true });
    const referral = data;
    const oldEarnings = old_data?.ppc_bitlabs_earnings || 0;
    const newEarnings = referral.ppc_bitlabs_earnings || 0;
    const delta = newEarnings - oldEarnings;
    if (delta <= 0) return Response.json({ ok: true });

    const MILESTONE_INTERVAL = 8; // Every $8
    const lastMilestone = referral.last_mlm_milestone || 0;
    const currentMilestone = Math.floor(newEarnings / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;

    if (currentMilestone > lastMilestone) {
      const levels = [
        { id: referral.level_1_referrer_id, pct: 0.10 },
        { id: referral.level_2_referrer_id, pct: 0.05 },
        { id: referral.level_3_referrer_id, pct: 0.025 }
      ];

      for (const level of levels) {
        if (!level.id) continue;
        const bonus = parseFloat((MILESTONE_INTERVAL * level.pct).toFixed(2));

        // Create ReferralPayout
        await base44.asServiceRole.entities.ReferralPayout.create({
          user_id: level.id,
          referral_id: referral.id,
          amount: bonus,
          payout_type: 'mlm_commission',
          status: 'pending'
        });

        // Update MLMNode credit
        const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: level.id });
        if (nodes.length > 0) {
          await base44.asServiceRole.entities.MLMNode.update(nodes[0].id, {
            website_credit_balance: parseFloat(((nodes[0].website_credit_balance || 0) + bonus).toFixed(2)),
            total_mlm_bonuses_received: parseFloat(((nodes[0].total_mlm_bonuses_received || 0) + bonus).toFixed(2))
          });
        }

        await base44.asServiceRole.entities.Notification.create({
          user_id: level.id,
          type: 'mlm_commission',
          title: `💰 MLM Commission: +$${bonus}!`,
          message: `Your referral network earned you $${bonus} in commission. Keep growing your network!`,
          is_read: false
        });
      }

      // Update milestone tracker
      await base44.asServiceRole.entities.Referral.update(referral.id, {
        last_mlm_milestone: currentMilestone
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});