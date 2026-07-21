import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Called after a user completes a qualifying action (survey, purchase).
 * Pass ref_code from session/localStorage set when they first landed via referral link.
 * This verifies + records the conversion, updates earnings, and queues a payout if threshold met.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ref_code, action_type, earned_amount } = await req.json();
    // action_type: 'survey_completed' | 'purchase'
    // earned_amount: USD amount the referred user earned (for commission calc)

    if (!ref_code) return Response.json({ error: 'ref_code required' }, { status: 400 });

    // Find the referral link
    const links = await base44.asServiceRole.entities.CustomReferralLink.filter({ link_code: ref_code });
    if (!links.length) return Response.json({ error: 'Link not found' }, { status: 404 });
    const link = links[0];

    // Find the referral record for the user who owns this link
    const referrals = await base44.asServiceRole.entities.Referral.filter({
      referrer_user_id: link.user_id,
      referred_user_id: user.id,
    });

    // Calculate commission (25% of earned_amount, platform standard)
    const commission = earnedAmount => Math.max(0, (earnedAmount || 0) * 0.25);
    const commissionAmount = commission(earned_amount || 0);

    // Update the referral record
    if (referrals.length) {
      const referral = referrals[0];
      const newTotal = (referral.total_earnings || 0) + (earned_amount || 0);
      const newCommission = (referral.commission_earned || 0) + commissionAmount;
      const updates = {
        total_earnings: newTotal,
        commission_earned: newCommission,
        status: newTotal >= 4 ? 'completed' : 'active',
        milestone_4_paid: newTotal >= 4 ? true : referral.milestone_4_paid,
        last_tracked_earning: earned_amount || 0,
      };
      await base44.asServiceRole.entities.Referral.update(referral.id, updates);
    }

    // Update link: conversions + total_earned
    await base44.asServiceRole.entities.CustomReferralLink.update(link.id, {
      conversions: (link.conversions || 0) + 1,
      total_earned: (link.total_earned || 0) + commissionAmount,
    });

    // Track conversion in campaign if applicable
    if (link.campaign_id) {
      await base44.asServiceRole.functions.invoke('trackReferralClick', {
        link_code: ref_code,
        action: 'conversion',
      });
    }

    // Check if referrer qualifies for auto-payout
    const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: link.user_id });
    if (prefs.length && prefs[0].auto_payout_enabled) {
      const pref = prefs[0];
      // Get total pending commission for this user
      const allReferrals = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: link.user_id });
      const totalPending = allReferrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
      const threshold = pref.minimum_payout_threshold || 50;

      if (totalPending >= threshold) {
        // Create a pending payout record
        const existingPending = await base44.asServiceRole.entities.Payout.filter({
          user_id: link.user_id,
          status: 'pending',
          payout_type: 'referral_commission',
        });
        if (!existingPending.length) {
          await base44.asServiceRole.entities.Payout.create({
            user_id: link.user_id,
            amount: totalPending,
            payout_type: 'referral_commission',
            method: pref.payout_method || 'paypal',
            status: 'pending',
            description: `Auto-payout: $${totalPending.toFixed(2)} referral commission`,
            recipient_email: pref.paypal_email || '',
          });
        }
      }
    }

    return Response.json({
      success: true,
      action_type,
      commission_earned: commissionAmount,
      conversion_recorded: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});