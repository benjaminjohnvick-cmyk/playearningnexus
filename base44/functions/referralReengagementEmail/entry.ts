// Scheduled: runs daily — sends re-engagement emails to stalled referrals (7+ days inactive, < $5 earned)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin-triggered calls OR scheduled automation (no user auth for scheduled)
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch (_) { /* scheduled call — proceed */ }

    const sequences = await base44.asServiceRole.entities.ReferralEmailSequence.filter({ is_active: true });
    const allUsers = await base44.asServiceRole.entities.User.list();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let sent = 0;
    let throttled = 0;
    const results = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const seq of sequences) {
      // Skip if milestone already reached (they're engaged)
      if (seq.milestone_sent) continue;
      // Skip if already sent re-engagement recently (within 7 days)
      if (seq.reengagement_sent_at && new Date(seq.reengagement_sent_at) > sevenDaysAgo) continue;

      // Check inactivity: last_activity_date more than 7 days ago
      const lastActivity = seq.last_activity_date ? new Date(seq.last_activity_date) : new Date(seq.created_date || Date.now());
      if (lastActivity > sevenDaysAgo) continue; // still active

      const user = allUsers.find(u => u.id === seq.user_id);
      const referrer = allUsers.find(u => u.id === seq.referrer_user_id);
      if (!user?.email) continue;

      // Daily email throttle — max 1 automated email per user per day
      const lastEmailDate = user.last_automated_email_date?.split('T')[0];
      if (lastEmailDate === todayStr) { throttled++; continue; }

      const referrerName = referrer?.full_name || 'your friend';
      const totalEarned = seq.total_earned || 0;
      const remaining = Math.max(0, 5 - totalEarned).toFixed(2);

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `⏰ ${referrerName} is wondering where you went — come back & earn!`,
        body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="font-size:52px;margin-bottom:8px;">👀</div>
    <h1 style="color:#fff;margin:0;font-size:24px;">We miss you on GamerGain!</h1>
    <p style="color:rgba(255,255,255,0.85);margin-top:8px;">${referrerName} is earning — you should be too</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#374151;">Hey ${user.full_name || 'there'},</p>
    <p style="color:#6b7280;">It's been a while since you've been active. You've earned <strong>$${totalEarned.toFixed(2)}</strong> so far — just <strong>$${remaining}</strong> away from your first major milestone!</p>

    <div style="background:#f5f3ff;border:2px solid #8b5cf6;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#5b21b6;font-weight:bold;font-size:18px;margin:0;">You're $${remaining} away from $5 🎯</p>
      <p style="color:#7c3aed;margin:6px 0 0;font-size:14px;">That's just ${Math.ceil(remaining / 0.5)} quick surveys away</p>
    </div>

    <p style="color:#374151;font-weight:bold;">Why come back now?</p>
    <div style="background:#f9fafb;border-radius:12px;padding:16px;margin:12px 0;">
      <p style="margin:6px 0;color:#374151;">💸 New high-paying surveys added daily</p>
      <p style="margin:6px 0;color:#374151;">🎁 Unlock game store rewards at $3/day</p>
      <p style="margin:6px 0;color:#374151;">📈 Your referral earnings grow with every active day</p>
    </div>

    <a href="${globalThis.location?.origin || 'https://app.gamergain.com'}/Surveys"
       style="display:block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:16px;border-radius:10px;text-align:center;text-decoration:none;font-weight:bold;font-size:16px;margin-top:20px;">
      Jump Back In →
    </a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">GamerGain · Unsubscribe anytime</p>
  </div>
</div>
        `.trim(),
      });

      // Update sequence
      await base44.asServiceRole.entities.ReferralEmailSequence.update(seq.id, {
        reengagement_sent: true,
        reengagement_sent_at: new Date().toISOString(),
        reengagement_count: (seq.reengagement_count || 0) + 1,
      });

      await base44.asServiceRole.entities.User.update(user.id, { last_automated_email_date: new Date().toISOString() });
      sent++;
      results.push({ user_id: seq.user_id, email: user.email });
    }

    return Response.json({ ok: true, sent, throttled, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});