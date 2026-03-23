import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Called on a schedule (every 30 min) OR triggered manually from admin
// Detects: click spikes, rapid sign-ups with no conversion, suspicious link patterns
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [links, referrals, admins] = await Promise.all([
      base44.entities.CustomReferralLink.list('-updated_date', 300),
      base44.entities.Referral.list('-created_date', 500),
      base44.entities.User.filter({ role: 'admin' }),
    ]);

    const alerts = [];
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // ── Rule 1: Click spike — link with >50 clicks but 0 conversions ──
    links.forEach(link => {
      const clicks = link.clicks || 0;
      const conversions = link.conversions || 0;
      if (clicks >= 50 && conversions === 0) {
        alerts.push({
          type: 'click_spike',
          severity: clicks >= 200 ? 'high' : 'medium',
          title: `Click Spike Detected`,
          message: `Link "${link.campaign_name || link.link_code}" has ${clicks} clicks with 0 conversions. Possible bot traffic or low-quality source.`,
          link_id: link.id,
          user_id: link.user_id,
        });
      }
    });

    // ── Rule 2: Referral burst — >5 referrals from same referrer in 1 hour ──
    const recentReferrals = referrals.filter(r => new Date(r.created_date) >= oneHourAgo);
    const referrerCounts = {};
    recentReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      referrerCounts[r.referrer_user_id] = (referrerCounts[r.referrer_user_id] || 0) + 1;
    });
    Object.entries(referrerCounts).forEach(([uid, count]) => {
      if (count >= 5) {
        alerts.push({
          type: 'rapid_signups',
          severity: count >= 10 ? 'high' : 'medium',
          title: `Rapid Sign-Up Burst`,
          message: `User ${uid.slice(0, 8)} generated ${count} referrals in the last hour. Possible coordinated sign-up fraud.`,
          user_id: uid,
        });
      }
    });

    // ── Rule 3: High volume zero-earn referrals (last 24h, no earnings) ──
    const dayReferrals = referrals.filter(r => new Date(r.created_date) >= oneDayAgo);
    const referrerEarnings = {};
    dayReferrals.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!referrerEarnings[r.referrer_user_id]) referrerEarnings[r.referrer_user_id] = { count: 0, earnings: 0 };
      referrerEarnings[r.referrer_user_id].count++;
      referrerEarnings[r.referrer_user_id].earnings += r.commission_earned || 0;
    });
    Object.entries(referrerEarnings).forEach(([uid, data]) => {
      if (data.count >= 10 && data.earnings === 0) {
        alerts.push({
          type: 'zero_conversion_intent',
          severity: 'medium',
          title: `Low Conversion Intent Pattern`,
          message: `User ${uid.slice(0, 8)} had ${data.count} referrals in 24h with $0 commission earned — possible low-quality traffic.`,
          user_id: uid,
        });
      }
    });

    if (alerts.length === 0) {
      return Response.json({ success: true, alerts_sent: 0, message: 'No suspicious patterns detected.' });
    }

    // ── Save alerts as Notifications for admins ──
    const adminEmails = admins.map(a => a.email).filter(Boolean);
    const notifications = [];

    for (const alert of alerts) {
      // In-app notification for each admin
      for (const admin of admins) {
        await base44.entities.Notification.create({
          user_id: admin.id,
          type: 'referral_earnings',
          title: `🚨 ${alert.title}`,
          message: alert.message,
          status: 'unread',
          delivery_method: ['in_app'],
          icon: 'alert-triangle',
        });
      }
      notifications.push(alert);
    }

    // ── Send consolidated email to all admins ──
    const highSeverity = alerts.filter(a => a.severity === 'high');
    const emailBody = `
<h2>🚨 GamerGain Fraud Alert Report</h2>
<p><strong>${alerts.length} suspicious pattern(s) detected</strong> (${highSeverity.length} high severity)</p>
<hr/>
${alerts.map(a => `
  <div style="margin-bottom:16px;padding:12px;border-left:4px solid ${a.severity === 'high' ? '#dc2626' : '#f59e0b'};background:#fafafa;">
    <strong>${a.title}</strong> <span style="color:${a.severity === 'high' ? '#dc2626' : '#d97706'}">[${a.severity.toUpperCase()}]</span><br/>
    <p>${a.message}</p>
  </div>
`).join('')}
<p style="color:#6b7280;font-size:12px;">Review these in the Admin Dashboard → Compliance tab.</p>
    `.trim();

    for (const email of adminEmails) {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `🚨 GamerGain Fraud Alert: ${alerts.length} suspicious pattern(s) detected`,
        body: emailBody,
      });
    }

    return Response.json({ success: true, alerts_sent: alerts.length, high_severity: highSeverity.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});