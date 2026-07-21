import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin or scheduled invocation
    const today = new Date().toISOString().split('T')[0];

    // Get all users
    const users = await base44.asServiceRole.entities.User.list();

    // Get today's earnings for all users
    const todayEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({ date: today });
    const earningsMap = {};
    todayEarnings.forEach(e => { earningsMap[e.user_id] = e.total_earned || 0; });

    let emailsSent = 0;
    let smsSent = 0;
    let throttled = 0;
    const errors = [];

    const todayStr = new Date().toISOString().split('T')[0];
    const alreadyEmailedToday = new Set();

    for (const user of users) {
      if (!user.email) continue;

      // Daily email throttle — max 1 automated email per user per day
      const lastEmailDate = user.last_automated_email_date?.split('T')[0];
      if (lastEmailDate === todayStr || alreadyEmailedToday.has(user.id)) {
        throttled++;
        continue;
      }

      const earned = earningsMap[user.id] || 0;
      if (earned >= 3) continue; // Already hit goal today, skip

      const remaining = (3 - earned).toFixed(2);
      const subject = `⏰ GamerGain Daily Reminder – $${remaining} left to reach your goal!`;
      const body = `
Hi ${user.full_name || 'GamerGainer'},

Don't forget to complete your daily surveys on GamerGain! 🎮

Your progress today: $${earned.toFixed(2)} / $3.00 earned

You need just $${remaining} more to unlock the game store for today.

📋 Remember: Each survey pays you 50% of its value. Complete $6 in surveys = $3 earned for you.

👉 Log in now and complete surveys: ${req.headers.get('origin') || 'https://gamergain.app'}/InAppGameStore

---
🚀 Also, share your referral link and earn $0.25 every time a friend earns $3 in a day!

Happy earning,
The GamerGain Team
      `.trim();

      // Try SMS first if phone number is set, otherwise send email
      const phoneNumber = user.phone_number;

      if (phoneNumber) {
        try {
          const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
          const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
          const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

          if (twilioSid && twilioToken && twilioPhone) {
            const smsBody = `GamerGain: You're $${remaining} away from your $3 daily goal! Complete surveys to unlock the store. ${req.headers.get('origin') || 'https://gamergain.app'}/InAppGameStore`;

            const smsResponse = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  From: twilioPhone,
                  To: phoneNumber,
                  Body: smsBody
                })
              }
            );

            if (smsResponse.ok) {
              smsSent++;
              continue; // SMS sent, skip email
            }
          }
        } catch (smsErr) {
          // Fall through to email
        }
      }

      // Send email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject,
          body,
          from_name: 'GamerGain'
        });
        await base44.asServiceRole.entities.User.update(user.id, { last_automated_email_date: new Date().toISOString() });
        alreadyEmailedToday.add(user.id);
        emailsSent++;
      } catch (emailErr) {
        errors.push(`Failed to email ${user.email}: ${emailErr.message}`);
      }
    }

    return Response.json({
      ok: true,
      emailsSent,
      smsSent,
      throttled,
      errors,
      message: `Sent ${emailsSent} emails and ${smsSent} SMS reminders (${throttled} throttled)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});