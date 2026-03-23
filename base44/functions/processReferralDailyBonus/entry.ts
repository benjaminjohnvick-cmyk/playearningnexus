import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;
    if (!data) return Response.json({ ok: true, message: 'No data' });

    const { user_id, total_earned, date } = data;

    // Only process if user has earned $3+ today (their 50% share)
    if (!total_earned || total_earned < 3) {
      return Response.json({ ok: true, message: 'Goal not yet reached' });
    }

    // Check if we already paid the referral bonus today
    const today = date || new Date().toISOString().split('T')[0];
    const existingBonus = await base44.asServiceRole.entities.Transaction.filter({
      user_id: user_id,
      transaction_type: 'referral_daily_bonus_received',
    });

    const alreadyPaidToday = existingBonus.some(t => {
      const txDate = new Date(t.created_date).toISOString().split('T')[0];
      return txDate === today;
    });

    if (alreadyPaidToday) {
      return Response.json({ ok: true, message: 'Bonus already paid today' });
    }

    // Find the referral record where this user was referred
    const referrals = await base44.asServiceRole.entities.Referral.filter({
      referred_user_id: user_id
    });

    if (!referrals.length) {
      return Response.json({ ok: true, message: 'No referrer found' });
    }

    const referral = referrals[0];
    const referrerId = referral.referrer_user_id;

    // Get referrer user data
    const allUsers = await base44.asServiceRole.entities.User.list();
    const referrer = allUsers.find(u => u.id === referrerId);
    if (!referrer) return Response.json({ ok: true, message: 'Referrer not found' });

    const bonusAmount = 0.25;

    // Credit $0.25 to referrer's balance
    await base44.asServiceRole.auth.updateUser(referrerId, {
      current_balance: (referrer.current_balance || 0) + bonusAmount,
      total_earnings: (referrer.total_earnings || 0) + bonusAmount
    });

    // Update referral commission_earned
    await base44.asServiceRole.entities.Referral.update(referral.id, {
      commission_earned: (referral.commission_earned || 0) + bonusAmount,
      status: 'active'
    });

    // Record the transaction
    await base44.asServiceRole.entities.Transaction.create({
      user_id: referrerId,
      amount: bonusAmount,
      transaction_type: 'referral_daily_bonus',
      status: 'completed',
      description: `Referral bonus: your referral earned $3 today`
    });

    // Mark that this referred user triggered a bonus today
    await base44.asServiceRole.entities.Transaction.create({
      user_id: user_id,
      amount: 0,
      transaction_type: 'referral_daily_bonus_received',
      status: 'completed',
      description: `Referral bonus paid to referrer`
    });

    // Send notification to referrer
    await base44.asServiceRole.entities.Notification.create({
      user_id: referrerId,
      type: 'referral_earnings',
      title: '💰 Referral Bonus Earned!',
      message: `One of your referrals earned $3 today! You received $0.25. Keep sharing your referral link for more bonuses.`,
      status: 'unread',
      delivery_method: ['in_app']
    });

    // Send notification to referred user about their goal achievement
    await base44.asServiceRole.entities.Notification.create({
      user_id: user_id,
      type: 'points_earned',
      title: '🎯 Daily Goal Achieved!',
      message: `You hit your $3 daily goal today! The game store is now unlocked. +15 XP earned.`,
      status: 'unread',
      delivery_method: ['in_app']
    });

    return Response.json({ ok: true, message: `Referral bonus of $${bonusAmount} paid to ${referrerId}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});