import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Scheduled weekly — finds top earners for the past 7 days and sends winner notifications.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    // Get recent daily earnings
    const recentEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({});
    const weeklyEarnings = recentEarnings.filter(e => e.date >= cutoffDate);

    // Aggregate by user
    const userTotals = {};
    weeklyEarnings.forEach(e => {
      if (!userTotals[e.user_id]) userTotals[e.user_id] = { surveys: 0, earned: 0, goalsmet: 0 };
      userTotals[e.user_id].earned += (e.total_earned || 0);
      userTotals[e.user_id].surveys += (e.total_surveys_completed || 0);
      if (e.goal_met) userTotals[e.user_id].goalsmet++;
    });

    // Get referral commissions for the week
    const recentTransactions = await base44.asServiceRole.entities.PPCTransaction.filter({ transaction_type: 'referral_commission' });
    recentTransactions
      .filter(t => t.created_date >= sevenDaysAgo.toISOString())
      .forEach(t => {
        if (!userTotals[t.user_id]) userTotals[t.user_id] = { surveys: 0, earned: 0, goalsmet: 0 };
        userTotals[t.user_id].earned += (t.net_amount || t.amount || 0);
      });

    const sorted = Object.entries(userTotals)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 3);

    if (sorted.length === 0) {
      return Response.json({ ok: true, message: 'No earners this week' });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    const medals = ['🥇 #1 Top Earner', '🥈 #2 Runner-Up', '🥉 #3 Third Place'];
    let notified = 0;

    for (let i = 0; i < sorted.length; i++) {
      const { userId, earned, surveys } = sorted[i];
      const winner = userMap[userId];
      if (!winner?.email) continue;

      // In-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        type: 'weekly_top_earner',
        title: `🏆 You made the Weekly Top Earners! ${medals[i]}`,
        message: `You earned $${earned.toFixed(2)} this week from ${surveys} surveys, landing you in the top 3 on the leaderboard!`,
        status: 'unread',
        delivery_method: ['in_app'],
      });

      // Email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: winner.email,
        subject: `🏆 You're a Weekly Top Earner! ${medals[i]}`,
        body: `Hi ${winner.full_name || 'there'},

Congratulations! You made the GamerGain Weekly Leaderboard!

${medals[i]}
💰 Weekly Earnings: $${earned.toFixed(2)}
📋 Surveys Completed: ${surveys}

Keep it up and compete for the top spot next week. Your ranking is live on the leaderboard now.

👉 View Leaderboard: https://gamergain.base44.app/Leaderboard

Happy earning!
— The GamerGain Team`,
      });

      notified++;
    }

    return Response.json({ ok: true, notified, top3: sorted.map((s, i) => ({ rank: i + 1, userId: s.userId, earned: s.earned })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});