// Scheduled function: detects users inactive 24+ hours and sends personalized streak reminders
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const today = now.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const users = await base44.asServiceRole.entities.User.list();

    // Get today's and yesterday's daily earnings to detect inactivity
    const [todayEarningsArr, yesterdayEarningsArr] = await Promise.all([
      base44.asServiceRole.entities.DailyEarnings.filter({ date: today }),
      base44.asServiceRole.entities.DailyEarnings.filter({ date: yesterdayStr }),
    ]);

    const todayMap = {};
    todayEarningsArr.forEach(e => { todayMap[e.user_id] = e.total_earned || 0; });

    const yesterdayMap = {};
    yesterdayEarningsArr.forEach(e => { yesterdayMap[e.user_id] = e.total_earned || 0; });

    // Get streaks for context
    const streaks = await base44.asServiceRole.entities.Streak.list();
    const streakMap = {};
    streaks.forEach(s => { streakMap[s.user_id] = s; });

    let emailsSent = 0;
    let smsSent = 0;
    let notifsSent = 0;
    const errors = [];

    for (const user of users) {
      if (!user.email) continue;

      const todayEarned = todayMap[user.id] || 0;
      const yesterdayEarned = yesterdayMap[user.id] || 0;

      // Only notify if: didn't earn anything today AND didn't earn yesterday (24h+ inactive)
      const inactive24h = todayEarned === 0 && yesterdayEarned === 0;
      if (!inactive24h) continue;

      const streak = streakMap[user.id];
      const currentStreak = streak?.current_streak || 0;
      const bestStreak = streak?.longest_streak || 0;

      // Personalize message based on streak history
      let streakMsg = '';
      if (currentStreak >= 3) {
        streakMsg = `You had a ${currentStreak}-day streak going — don't break it now!`;
      } else if (bestStreak >= 5) {
        streakMsg = `Your best streak was ${bestStreak} days. Start a new one today!`;
      } else {
        streakMsg = `Start your survey streak today — just 8 minutes to earn $3!`;
      }

      const subject = `🔥 Survey Streak Alert — Complete today's surveys, ${user.full_name?.split(' ')[0] || 'friend'}!`;
      const emailBody = `
Hi ${user.full_name || 'GamerGainer'},

You haven't completed any surveys in the last 24 hours! 😮

${streakMsg}

It only takes one 8-minute survey session to earn your $3 daily goal and unlock the game store.

💡 Tip: Survey availability is highest in the morning — log in now for the best options!

👉 Complete surveys now: https://gamergain.app/Surveys

📊 Your stats:
• Current streak: ${currentStreak} days
• Best streak ever: ${bestStreak} days

Happy earning,
The GamerGain Team
      `.trim();

      // Create in-app notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          title: `🔥 Don't break your streak!`,
          message: `${streakMsg} Complete a quick survey now to earn your $3 daily goal.`,
          type: 'streak_reminder',
          action_url: '/Surveys',
          is_read: false,
        });
        notifsSent++;
      } catch (_) {}

      // Try SMS if phone available
      const phoneNumber = user.phone_number;
      if (phoneNumber) {
        try {
          const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
          const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
          const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

          if (twilioSid && twilioToken && twilioPhone) {
            const smsBody = `GamerGain 🔥 ${streakMsg} Complete surveys in 8 min → gamergain.app/Surveys`;
            const resp = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ From: twilioPhone, To: phoneNumber, Body: smsBody }),
              }
            );
            if (resp.ok) { smsSent++; continue; }
          }
        } catch (_) {}
      }

      // Fall back to email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject,
          body: emailBody,
          from_name: 'GamerGain',
        });
        emailsSent++;
      } catch (err) {
        errors.push(`${user.email}: ${err.message}`);
      }
    }

    return Response.json({
      ok: true,
      emailsSent,
      smsSent,
      notifsSent,
      errors,
      message: `Streak reminders: ${emailsSent} emails, ${smsSent} SMS, ${notifsSent} in-app notifications sent`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});