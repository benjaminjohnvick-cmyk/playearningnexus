import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const referral = data;
    if (!referral?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // Welcome the referred user + notify referrer
      const referrer = referral.referrer_user_id
        ? (await base44.asServiceRole.entities.User.filter({ id: referral.referrer_user_id }))[0]
        : null;
      const referred = referral.referred_user_id
        ? (await base44.asServiceRole.entities.User.filter({ id: referral.referred_user_id }))[0]
        : null;

      // Notify referrer their link worked
      if (referrer) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: referral.referrer_user_id,
          type: 'referral_signup',
          title: '🎉 New Referral Signup!',
          message: `${referred?.full_name || 'Someone'} signed up using your referral link! You'll earn commission as they complete tasks.`,
          is_read: false
        });
      }

      // Send welcome email to referred user explaining the referral bonus
      if (referred?.email) {
        await base44.integrations.Core.SendEmail({
          to: referred.email,
          subject: `🎮 Welcome to GamerGain — You were referred by ${referrer?.full_name || 'a friend'}!`,
          body: `Welcome to GamerGain! You were invited by ${referrer?.full_name || 'a friend'}. Complete surveys and earn real money. Your referrer gets rewarded when you earn, so you're both winning!`
        });
      }

      // Build MLM node for 3-level tracking
      let level1 = referral.referrer_user_id;
      let level2 = null;
      let level3 = null;

      if (level1) {
        const parentNode = (await base44.asServiceRole.entities.MLMNode.filter({ user_id: level1 }))[0];
        if (parentNode) {
          level2 = parentNode.level_1_parent_id || null;
          if (level2) {
            const grandparentNode = (await base44.asServiceRole.entities.MLMNode.filter({ user_id: level2 }))[0];
            level3 = grandparentNode?.level_1_parent_id || null;
          }
        }
      }

      // Create or update MLMNode for the referred user
      const existingNode = await base44.asServiceRole.entities.MLMNode.filter({ user_id: referral.referred_user_id });
      if (existingNode.length === 0) {
        await base44.asServiceRole.entities.MLMNode.create({
          user_id: referral.referred_user_id,
          level_1_parent_id: level1,
          level_2_parent_id: level2,
          level_3_parent_id: level3
        });
      }
    }

    if (event?.type === 'update' && data.status === 'completed') {
      // Referral completed → pay $5 website credit to referrer
      if (referral.referrer_user_id) {
        const referrer = (await base44.asServiceRole.entities.User.filter({ id: referral.referrer_user_id }))[0];
        if (referrer) {
          const node = (await base44.asServiceRole.entities.MLMNode.filter({ user_id: referral.referrer_user_id }))[0];
          if (node) {
            await base44.asServiceRole.entities.MLMNode.update(node.id, {
              website_credit_balance: (node.website_credit_balance || 0) + 5,
              direct_referral_credits_earned: (node.direct_referral_credits_earned || 0) + 5,
              total_referrals_converted: (node.total_referrals_converted || 0) + 1
            });
          }
          await base44.asServiceRole.entities.Notification.create({
            user_id: referral.referrer_user_id,
            type: 'referral_completed',
            title: '💰 Referral Completed — $5 Credit!',
            message: `Your referral completed their first task! You earned $5 website credit.`,
            is_read: false
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});