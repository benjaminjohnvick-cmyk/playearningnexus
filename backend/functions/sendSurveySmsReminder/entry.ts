import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split('T')[0];

    // Fetch all users (service role for scheduled task)
    const users = await base44.asServiceRole.entities.User.list();

    // Check who has earned today via DailyEarnings (survey earnings proxy)
    const todayEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({ date: today });
    const earningsMap = {};
    todayEarnings.forEach((e) => { earningsMap[e.user_id] = e.total_earned || 0; });

    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioSid || !twilioToken || !twilioPhone) {
      return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const DAILY_GOAL = 4.00; // User's 50% share of $8/day minimum
    const appUrl = req.headers.get('origin') || 'https://gamergain.app';

    let smsSent = 0;
    let alreadyCompleted = 0;
    let noPhone = 0;
    let optedOut = 0;
    const errors = [];

    for (const user of users) {
      const phoneNumber = user.phone_number;
      const smsPref = user.notification_preferences?.sms_enabled;

      // Skip if no phone number or SMS not enabled
      if (!phoneNumber) { noPhone++; continue; }
      if (smsPref === false) { optedOut++; continue; }

      const earned = earningsMap[user.id] || 0;

      // Skip users who already hit their daily survey goal
      if (earned >= DAILY_GOAL) { alreadyCompleted++; continue; }

      const remaining = (DAILY_GOAL - earned).toFixed(2);
      const smsBody = `🎮 GamerGain: You still need $${remaining} in survey earnings today! Complete your surveys now to hit your $${DAILY_GOAL.toFixed(2)} goal. ${appUrl}/Surveys`;

      try {
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
        } else {
          const errText = await smsResponse.text();
          errors.push(`SMS failed for ${user.email || user.id}: ${errText}`);
        }
      } catch (err) {
        errors.push(`SMS error for ${user.email || user.id}: ${err.message}`);
      }
    }

    return Response.json({
      ok: true,
      date: today,
      smsSent,
      alreadyCompleted,
      noPhone,
      optedOut,
      totalUsers: users.length,
      errors: errors.slice(0, 20),
      message: `Sent ${smsSent} SMS survey reminders (${alreadyCompleted} already done, ${noPhone} no phone, ${optedOut} opted out)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});