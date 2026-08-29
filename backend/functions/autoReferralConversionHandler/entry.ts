import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { emitEvent } from "../../sdk/events.ts";
import { referralTiersEnabled, referralBonusAmount } from "../../sdk/referral-tiers.ts";

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

      // Emit the grounded outcome event so attributeOutcomes can confirm the referral-growth agent's
      // learning against a REAL conversion (referral.converted is in its OUTCOME_MAP).
      await emitEvent("referral.converted", {
        referral_id: referral.id,
        referrer_user_id: referral.referrer_user_id,
        referred_user_id: referral.referred_user_id,
      }, { source: "autoReferralConversionHandler" }).catch(() => null);

      // ── Two-tier referral bonus (GATED — pending counsel) ────────────────────────────────────────────
      // On a REAL user conversion, stage a PENDING ReferralBonus (USER kind) so the gated referralBonusSweep
      // can pay the small Site Cash bonus once enabled. Additive + idempotent + moves NO money: while
      // REFERRAL_TIERS_ENABLED is off this block no-ops entirely. (Advertiser-tier bonuses are staged from the
      // advertiser-payment-clear flow via referralBonusRecord, not here — a user conversion is the user kind.)
      if (referralTiersEnabled() && referral.referrer_user_id !== referral.referred_user_id) {
        const dup = await base44.asServiceRole.entities.ReferralBonus
          .filter({ referrer_user_id: referral.referrer_user_id, referred_user_id: referral.referred_user_id, kind: "user" }, "-created_date", 1)
          .then((r: any) => r || []).catch(() => []);
        if (!dup?.[0]) {
          const nowISO = new Date().toISOString();
          await base44.asServiceRole.entities.ReferralBonus.create({
            referrer_user_id: referral.referrer_user_id, referred_user_id: referral.referred_user_id,
            kind: "user", tier: null, amount_sitecash: referralBonusAmount("user"),
            payment_cleared_at: null, kyc_ok: false, self_referral: false, refunded: false, chargeback: false,
            active: true, status: "pending", created_at: nowISO, updated_at: nowISO,
          }).catch(() => null);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});