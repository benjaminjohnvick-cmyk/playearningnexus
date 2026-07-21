import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const referralId = event?.entity_id || data?.id;
    if (!referralId) return Response.json({ skipped: true });

    const referral = data || await base44.asServiceRole.entities.Referral.get(referralId);
    if (!referral) return Response.json({ skipped: true });

    const earners = [
      { userId: referral.level_1_referrer_id, bonus: 0.25 },
      { userId: referral.level_2_referrer_id, bonus: 0.15 },
      { userId: referral.level_3_referrer_id, bonus: 0.10 }
    ];

    for (const earner of earners) {
      if (!earner.userId) continue;
      const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: earner.userId });
      if (nodes.length === 0) continue;
      const node = nodes[0];

      const newDownlineEarnings = (node.total_downline_ppc_bitlabs_earnings || 0) + (referral.ppc_bitlabs_earnings || 0);
      const newBonuses = (node.total_mlm_bonuses_received || 0) + earner.bonus;

      await base44.asServiceRole.entities.MLMNode.update(node.id, {
        total_downline_ppc_bitlabs_earnings: newDownlineEarnings,
        total_mlm_bonuses_received: newBonuses,
        website_credit_balance: (node.website_credit_balance || 0) + earner.bonus
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});