import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Weekly Contest Winner Selector
 * Runs every Monday at 00:05 ET. Selects top referrers from the past 7 days,
 * creates Payout records, and sends winner notifications.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    // Allow headless scheduled calls; only block non-admin authenticated users
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all referrals created in the past week
    const allReferrals = await base44.asServiceRole.entities.Referral.list('-created_date', 2000);
    const weeklyReferrals = allReferrals.filter(r => r.created_date >= weekAgo && r.status === 'active');

    // Group by referrer
    const map = {};
    weeklyReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });

    const ranked = Object.values(map).sort((a, b) => b.count - a.count || b.commission - a.commission);

    const WEEKLY_PRIZES = [500, 250, 100, 50, 50, 25, 25, 25, 25, 25];
    const winners = ranked.slice(0, 10);
    const weekLabel = `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const results = [];

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const prize = WEEKLY_PRIZES[i] || 10;
      const rank = i + 1;

      // Get user details
      const users = await base44.asServiceRole.entities.User.filter({ id: winner.user_id });
      const winnerUser = users[0];
      if (!winnerUser) continue;

      // Create payout
      await base44.asServiceRole.entities.Payout.create({
        user_id: winner.user_id,
        recipient_type: 'user',
        recipient_id: winner.user_id,
        recipient_email: winnerUser.email,
        amount: prize,
        currency: 'USD',
        method: 'paypal',
        payout_type: 'contest_win',
        status: 'pending',
        description: `Weekly Referral Contest — Rank #${rank} — ${weekLabel} — ${winner.count} referrals`,
      });

      // Send in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_id: winner.user_id,
        type: 'achievement_unlocked',
        title: `🏆 You placed #${rank} in the Weekly Referral Contest!`,
        message: `Congratulations! You referred ${winner.count} users this week and won $${prize}. Payout is being processed.`,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/ReferralContest',
        icon: 'trophy',
      });

      // Send email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: winnerUser.email,
        subject: `🏆 You Won $${prize} in GamerGain's Weekly Referral Contest!`,
        body: `<h2>Congratulations, ${winnerUser.full_name}!</h2><p>You placed <strong>#${rank}</strong> in this week's Referral Contest with <strong>${winner.count} active referrals</strong>.</p><p>Your prize of <strong>$${prize}</strong> is being processed to your PayPal on file.</p><p>Keep referring to compete next week!</p><br><p>— The GamerGain Team</p>`,
        from_name: 'GamerGain Contests',
      });

      results.push({ rank, user_id: winner.user_id, email: winnerUser.email, referrals: winner.count, prize });
    }

    return Response.json({ success: true, week: weekLabel, winners: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});