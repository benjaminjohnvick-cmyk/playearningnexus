// Triggered by entity automation on DailyEarnings update
// Sends a 'Milestone' email when referred user crosses $5 total earned
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data } = payload;
    if (!data) return Response.json({ ok: true, message: 'No data' });

    const { user_id, total_earned } = data;
    if (!user_id || !total_earned) return Response.json({ ok: true, message: 'Missing fields' });

    // Only fire at the $5 threshold
    if (total_earned < 5) return Response.json({ ok: true, message: 'Not at milestone yet' });

    // Check sequence record — only send once
    const sequences = await base44.asServiceRole.entities.ReferralEmailSequence.filter({ user_id });
    const seq = sequences[0];
    if (!seq) return Response.json({ ok: true, message: 'No sequence record — not a referred user' });
    if (seq.milestone_sent) return Response.json({ ok: true, message: 'Milestone already sent' });

    const allUsers = await base44.asServiceRole.entities.User.list();
    const user = allUsers.find(u => u.id === user_id);
    const referrer = allUsers.find(u => u.id === seq.referrer_user_id);
    if (!user?.email) return Response.json({ ok: true, message: 'No email' });

    const referrerName = referrer?.full_name || 'your friend';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `🏆 You just hit $5 on GamerGain — you're on a roll!`,
      body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="font-size:56px;margin-bottom:8px;">🏆</div>
    <h1 style="color:#fff;margin:0;font-size:26px;">Milestone Reached!</h1>
    <p style="color:rgba(255,255,255,0.9);margin-top:6px;">You've earned your first $5 on GamerGain</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#374151;">Congrats ${user.full_name || 'there'}! 🎉</p>
    <p style="color:#6b7280;">You've officially earned your first <strong>$${total_earned.toFixed(2)}</strong> — and you're just getting started. ${referrerName} knew you'd crush it!</p>

    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="font-size:24px;font-weight:bold;color:#92400e;margin:0;">$${total_earned.toFixed(2)} earned 💰</p>
      <p style="color:#b45309;margin:6px 0 0;font-size:14px;">Keep going to unlock Tier 2 and earn even more!</p>
    </div>

    <p style="color:#374151;font-weight:bold;">What's next for you:</p>
    <div style="background:#f9fafb;border-radius:12px;padding:16px;margin:12px 0;">
      <p style="margin:4px 0;color:#374151;">🎯 Earn $3/day consistently → unlock Tier 2</p>
      <p style="margin:4px 0;color:#374151;">👥 Refer 10 friends → PPC Network access ($14,600/yr)</p>
      <p style="margin:4px 0;color:#374151;">💵 Withdraw your balance anytime via PayPal</p>
    </div>

    <a href="${globalThis.location?.origin || 'https://app.gamergain.com'}/Surveys"
       style="display:block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:16px;border-radius:10px;text-align:center;text-decoration:none;font-weight:bold;font-size:16px;margin-top:20px;">
      Keep Earning →
    </a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">GamerGain · Unsubscribe anytime</p>
  </div>
</div>
      `.trim(),
    });

    // Update sequence record & referrer's last_activity
    await base44.asServiceRole.entities.ReferralEmailSequence.update(seq.id, {
      milestone_sent: true,
      milestone_sent_at: new Date().toISOString(),
      total_earned,
      last_activity_date: new Date().toISOString(),
    });

    // Notify referrer too
    if (referrer) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: referrer.id,
        type: 'referral_earnings',
        title: '🏆 Your referral just hit $5!',
        message: `${user.full_name || 'One of your referrals'} just crossed $5 in earnings. Your commission is growing!`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    }

    return Response.json({ ok: true, message: `Milestone email sent to ${user.email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});