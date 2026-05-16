import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get last week's referral jackpot entries
    const lastWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const referralJackpots = await base44.asServiceRole.entities.ReferralJackpot.filter({
      created_date: { $gte: lastWeekStart },
      status: 'active'
    });

    if (!referralJackpots.length) {
      return Response.json({ message: 'No active jackpot entries' });
    }

    // Calculate total entries and weights by user
    const entriesByUser = {};
    referralJackpots.forEach(entry => {
      if (!entriesByUser[entry.user_id]) {
        entriesByUser[entry.user_id] = { entries: 0, email: entry.user_email };
      }
      entriesByUser[entry.user_id].entries += entry.jackpot_entries_earned || 1;
    });

    // Weighted random selection based on entry count
    const users = Object.entries(entriesByUser);
    const totalEntries = users.reduce((sum, [_, data]) => sum + data.entries, 0);

    let random = Math.random() * totalEntries;
    let winnerUserId = null;
    for (const [userId, data] of users) {
      random -= data.entries;
      if (random <= 0) {
        winnerUserId = userId;
        break;
      }
    }

    // Determine jackpot amount (pool from admin configuration)
    const globalSettings = await base44.asServiceRole.entities.GlobalSettings.list();
    const weeklyJackpotAmount = globalSettings[0]?.weekly_jackpot_amount || 100;

    // Process payout to winner
    const winnerUser = await base44.asServiceRole.entities.User.get(winnerUserId);
    const payout = await base44.asServiceRole.functions.invoke('paypalPayout', {
      recipient_email: winnerUser.email,
      amount: weeklyJackpotAmount,
      payout_type: 'referral_jackpot',
      description: `Weekly Referral Jackpot Winner - ${new Date().toLocaleDateString()}`
    });

    if (payout.success) {
      // Deduct entries from winner
      await base44.asServiceRole.entities.ReferralJackpot.update(referralJackpots[0].id, {
        status: 'completed',
        winner_id: winnerUserId,
        payout_amount: weeklyJackpotAmount,
        completed_date: new Date().toISOString()
      });

      // Notify winner
      await base44.integrations.Core.SendEmail({
        to: winnerUser.email,
        subject: `🎉 You Won the Weekly Referral Jackpot! $${weeklyJackpotAmount}`,
        body: `Congratulations! You were randomly selected from ${totalEntries} referral entries and won $${weeklyJackpotAmount}. The payout is being processed to your PayPal account.`
      });

      return Response.json({
        success: true,
        winner_id: winnerUserId,
        jackpot_amount: weeklyJackpotAmount,
        total_entries: totalEntries,
        total_participants: users.length
      });
    } else {
      throw new Error('Payout processing failed');
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});