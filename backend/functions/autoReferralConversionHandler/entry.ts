import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    if (event?.type !== 'update') return Response.json({ ok: true });
    const referral = data;
    const oldStatus = old_data?.status;
    const newStatus = referral.status;

    if (oldStatus === newStatus) return Response.json({ ok: true });

    if (newStatus === 'active') {
      // Create ReferralAchievement for referrer
      const referralCount = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: referral.referrer_user_id, status: 'active' });
      await base44.asServiceRole.entities.ReferralAchievement.create({
        user_id: referral.referrer_user_id,
        referral_id: referral.id,
        achievement_type: 'conversion',
        referral_count: referralCount.length
      });

      // Notify referrer
      await base44.asServiceRole.entities.Notification.create({
        user_id: referral.referrer_user_id,
        type: 'referral_converted',
        title: `🎉 Your Referral Signed Up!`,
        message: `Someone you referred just joined GamerGain! You'll earn commissions as they complete surveys and play games.`,
        is_read: false
      });

      // Update MLMNode referral count
      const nodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: referral.referrer_user_id });
      if (nodes.length > 0) {
        await base44.asServiceRole.entities.MLMNode.update(nodes[0].id, {
          total_referrals_converted: (nodes[0].total_referrals_converted || 0) + 1
        });
      }

      // Award XP for successful referral
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: referral.referrer_user_id,
        activity_type: 'referral_converted',
        points_earned: 100,
        metadata: { referred_user_id: referral.referred_user_id }
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});