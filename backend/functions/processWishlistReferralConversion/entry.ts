import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { referral_code } = await req.json();

    if (!referral_code) {
      return Response.json({ error: 'Referral code required' }, { status: 400 });
    }

    // Find referral
    const referrals = await base44.asServiceRole.entities.WishlistShareReferral.filter({
      referral_code: referral_code,
      status: 'active'
    });

    if (referrals.length === 0) {
      return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    const referral = referrals[0];
    const originalUserId = referral.user_id;

    // Award jackpot entries (5 per conversion)
    const jackpotEntriesAwarded = 5;
    
    // Award wishlist credit (random $1-5)
    const creditAwarded = Math.floor(Math.random() * 5) + 1;

    // Update referral
    await base44.asServiceRole.entities.WishlistShareReferral.update(referral.id, {
      conversions: (referral.conversions || 0) + 1,
      jackpot_entries_earned: (referral.jackpot_entries_earned || 0) + jackpotEntriesAwarded,
      wishlist_credit_earned: (referral.wishlist_credit_earned || 0) + creditAwarded,
      last_click_date: new Date().toISOString(),
    });

    // Award referrer's account with credit
    const originalUser = await base44.asServiceRole.entities.User.get(originalUserId);
    await base44.asServiceRole.auth.updateMe({
      id: originalUserId,
      total_earnings: (originalUser.total_earnings || 0) + creditAwarded,
    });

    return Response.json({
      success: true,
      jackpot_entries_awarded: jackpotEntriesAwarded,
      credit_awarded: creditAwarded,
      referrer_id: originalUserId,
    });
  } catch (error) {
    console.error('Referral conversion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});