import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { campaign_type } = await req.json();
    const now = new Date();
    const results = { sent: 0, skipped: 0, errors: 0 };

    const allUsers = await base44.asServiceRole.entities.User.list();
    const todayStr = new Date().toISOString().split('T')[0];
    const alreadyEmailedToday = new Set();

    for (const u of allUsers) {
      if (!u.email) { results.skipped++; continue; }

      // Daily email throttle — max 1 automated email per user per day
      const lastEmailDate = u.last_automated_email_date?.split('T')[0];
      if (lastEmailDate === todayStr || alreadyEmailedToday.has(u.id)) { results.skipped++; continue; }

      try {
        if (campaign_type === 'onboarding') {
          // Send only to users registered in the last 48 hours who haven't gotten onboarding
          const created = new Date(u.created_date);
          const hoursOld = (now - created) / (1000 * 60 * 60);
          if (hoursOld > 48 || u.onboarding_email_sent) { results.skipped++; continue; }

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: `Welcome to GamerGain, ${u.full_name?.split(' ')[0] || 'friend'}! 🎮`,
            body: `Hi ${u.full_name?.split(' ')[0] || 'there'},

Welcome to GamerGain — your new home for gaming and earning! 🎮💰

Here's how to get started:
✅ Complete your first survey and earn instantly
🎮 Browse 60+ premium games in the store
👥 Invite friends and earn $1 per active referral
🔥 Log in daily to build your streak and unlock multipliers
💸 Withdraw to PayPal, Venmo, or Cash App at any time

Your dashboard is ready: https://gamergain.app/UserDashboard

Let's get earning!
— The GamerGain Team`.trim(),
          });

          await base44.asServiceRole.entities.User.update(u.id, { onboarding_email_sent: true, last_automated_email_date: new Date().toISOString() });
          alreadyEmailedToday.add(u.id);
          results.sent++;
        }

        else if (campaign_type === 'winback') {
          // Users who haven't logged in for 3+ days
          const lastLogin = u.last_login_date ? new Date(u.last_login_date) : new Date(u.created_date);
          const daysSince = (now - lastLogin) / (1000 * 60 * 60 * 24);
          if (daysSince < 3 || daysSince > 14) { results.skipped++; continue; }
          if (u.last_winback_sent && (now - new Date(u.last_winback_sent)) / (1000 * 60 * 60 * 24) < 7) { results.skipped++; continue; }

          const balance = u.current_balance || 0;
          const earnings = u.total_earnings || 0;

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: `We miss you! ${balance > 0 ? `You have $${balance.toFixed(2)} waiting 💸` : 'New surveys are waiting for you 🎯'}`,
            body: `Hi ${u.full_name?.split(' ')[0] || 'there'},

It's been ${Math.floor(daysSince)} days since your last visit — and a lot has happened! 👀

${balance > 0 ? `💰 You have $${balance.toFixed(2)} in your account ready to withdraw!\n` : ''}${earnings > 0 ? `📈 Your total earnings so far: $${earnings.toFixed(2)}\n` : ''}
🆕 New high-paying surveys just dropped — some paying up to $5 each
🔥 Your daily login streak is waiting — come back to keep it alive
🏆 Weekly Referral Conquest leaderboard prizes are up for grabs

Come back and earn: https://gamergain.app/Surveys

See you soon,
— The GamerGain Team`.trim(),
          });

          await base44.asServiceRole.entities.User.update(u.id, { last_winback_sent: now.toISOString(), last_automated_email_date: new Date().toISOString() });
          alreadyEmailedToday.add(u.id);
          results.sent++;
        }

        else if (campaign_type === 'weekly_summary') {
          // Send to all active users weekly
          if (u.last_weekly_summary_sent) {
            const daysSince = (now - new Date(u.last_weekly_summary_sent)) / (1000 * 60 * 60 * 24);
            if (daysSince < 6) { results.skipped++; continue; }
          }

          const earnings = u.total_earnings || 0;
          const balance = u.current_balance || 0;
          const referrals = u.total_referrals || 0;

          const aiSummary = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Write a short, motivating 2-sentence weekly earnings summary for a GamerGain user.
Stats: total earnings $${earnings.toFixed(2)}, balance $${balance.toFixed(2)}, referrals ${referrals}.
Be encouraging and personalized. Mention their potential if they refer more or complete more surveys.`,
          });

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: `Your Weekly GamerGain Summary 📊 — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            body: `Hi ${u.full_name?.split(' ')[0] || 'there'},

Here's your weekly GamerGain report 📈

💰 Total Earned: $${earnings.toFixed(2)}
🏦 Available Balance: $${balance.toFixed(2)}
👥 Active Referrals: ${referrals}

${aiSummary || 'Keep up the great work! More surveys and opportunities are waiting for you.'}

📋 Browse this week's top surveys: https://gamergain.app/Surveys
💵 Withdraw your balance: https://gamergain.app/Withdrawal
👥 Refer friends for $1 each: https://gamergain.app/ReferralDashboard

Keep earning,
— The GamerGain Team`.trim(),
          });

          await base44.asServiceRole.entities.User.update(u.id, { last_weekly_summary_sent: now.toISOString(), last_automated_email_date: new Date().toISOString() });
          alreadyEmailedToday.add(u.id);
          results.sent++;
        }
      } catch {
        results.errors++;
      }
    }

    return Response.json({ success: true, campaign_type, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});