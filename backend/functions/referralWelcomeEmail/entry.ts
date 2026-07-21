// Triggered by entity automation on Referral create
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data } = payload;
    if (!data) return Response.json({ ok: true, message: 'No data' });

    const { referred_user_id, referrer_user_id, id: referralId } = data;
    if (!referred_user_id) return Response.json({ ok: true, message: 'No referred_user_id' });

    // Get referred user info
    const allUsers = await base44.asServiceRole.entities.User.list();
    const referredUser = allUsers.find(u => u.id === referred_user_id);
    const referrerUser = allUsers.find(u => u.id === referrer_user_id);
    if (!referredUser?.email) return Response.json({ ok: true, message: 'No email for referred user' });

    // Check if welcome email already sent
    const existing = await base44.asServiceRole.entities.ReferralEmailSequence.filter({ user_id: referred_user_id });
    if (existing.length > 0 && existing[0].welcome_sent) {
      return Response.json({ ok: true, message: 'Welcome already sent' });
    }

    // Daily email throttle — max 1 automated email per user per day
    const todayStr = new Date().toISOString().split('T')[0];
    const lastEmailDate = referredUser.last_automated_email_date?.split('T')[0];
    if (lastEmailDate === todayStr) {
      return Response.json({ ok: true, message: 'User already received an automated email today', throttled: true });
    }

    const referrerName = referrerUser?.full_name || 'a friend';
    const referralCode = `REF-${referred_user_id.slice(0, 8).toUpperCase()}`;

    // Send welcome email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: referredUser.email,
      subject: `🎉 Welcome to GamerGain — You were invited by ${referrerName}!`,
      body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#dc2626,#7c3aed);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:28px;">Welcome to GamerGain! 🎮</h1>
    <p style="color:rgba(255,255,255,0.85);margin-top:8px;">You were invited by <strong>${referrerName}</strong></p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#374151;">Hey ${referredUser.full_name || 'there'},</p>
    <p style="color:#6b7280;">You just joined one of the fastest-growing gaming reward platforms! Here's what to do next:</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-weight:bold;color:#111;">🚀 Quick Start Checklist</p>
      <p style="margin:4px 0;color:#374151;">✅ Complete your first survey to earn cash</p>
      <p style="margin:4px 0;color:#374151;">✅ Hit your $3 daily earning goal</p>
      <p style="margin:4px 0;color:#374151;">✅ Share your own referral link: <strong>${referralCode}</strong></p>
    </div>
    <div style="background:#ecfdf5;border:2px solid #10b981;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
      <p style="color:#065f46;font-weight:bold;font-size:18px;margin:0;">Earn up to $58,400/yr</p>
      <p style="color:#047857;margin:4px 0 0;font-size:14px;">Surveys + referral commissions + PPC network</p>
    </div>
    <a href="${globalThis.location?.origin || 'https://app.gamergain.com'}/Surveys" 
       style="display:block;background:linear-gradient(135deg,#dc2626,#7c3aed);color:#fff;padding:16px;border-radius:10px;text-align:center;text-decoration:none;font-weight:bold;font-size:16px;">
      Start Earning Now →
    </a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">GamerGain · Unsubscribe anytime</p>
  </div>
</div>
      `.trim(),
    });

    // Upsert sequence record
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferralEmailSequence.update(existing[0].id, {
        welcome_sent: true,
        welcome_sent_at: new Date().toISOString(),
        referrer_user_id,
        referral_id: referralId,
        last_activity_date: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.ReferralEmailSequence.create({
        user_id: referred_user_id,
        referrer_user_id,
        referral_id: referralId,
        welcome_sent: true,
        welcome_sent_at: new Date().toISOString(),
        last_activity_date: new Date().toISOString(),
        total_earned: 0,
        is_active: true,
      });
    }

    await base44.asServiceRole.entities.User.update(referred_user_id, { last_automated_email_date: new Date().toISOString() });

    return Response.json({ ok: true, message: `Welcome email sent to ${referredUser.email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});