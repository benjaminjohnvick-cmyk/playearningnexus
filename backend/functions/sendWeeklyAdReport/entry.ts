import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both scheduled (service role) and manual (authenticated user) calls
  let userId, userEmail, userName;

  try {
    const user = await base44.auth.me();
    if (user?.id) {
      userId = user.id;
      userEmail = user.email;
      userName = user.full_name || 'Advertiser';
    } else {
      throw new Error('no user');
    }
  } catch {
    // Called from scheduler — no user context, process all advertisers
    const allAds = await base44.asServiceRole.entities.AdListing.list('-updated_date', 200);
    if (!allAds.length) {
      return Response.json({ success: true, sent: 0, message: 'No ads found — nothing to report' });
    }
    const advertiserIds = [...new Set(allAds.map(a => a.owner_user_id))];

    let sent = 0;
    for (const uid of advertiserIds) {
      const userAds = allAds.filter(a => a.owner_user_id === uid);
      if (userAds.length === 0) continue;

      const users = await base44.asServiceRole.entities.User.filter({ id: uid });
      if (!users.length) continue;
      const u = users[0];

      await sendReportForUser(base44, u.id, u.email, u.full_name || 'Advertiser', userAds);
      sent++;
    }

    return Response.json({ success: true, sent });
  }

  // Manual single-user report
  const ads = await base44.entities.AdListing.filter({ owner_user_id: userId });
  if (ads.length === 0) {
    return Response.json({ error: 'No ads found' }, { status: 404 });
  }

  await sendReportForUser(base44, userId, userEmail, userName, ads);
  return Response.json({ success: true, message: 'Report sent to ' + userEmail });
});

async function sendReportForUser(base44, userId, email, name, ads) {
  const activeAds = ads.filter(a => a.status === 'active');
  const totalClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);
  const totalCompleted = ads.reduce((s, a) => s + (a.surveys_completed || 0), 0);
  const totalSpent = ads.reduce((s, a) => s + (a.total_spent || 0), 0);
  const avgCTR = totalClicks > 0 ? ((totalCompleted / totalClicks) * 100).toFixed(1) : '0.0';

  const topAd = [...ads].sort((a, b) => (b.surveys_completed || 0) - (a.surveys_completed || 0))[0];

  const adsRows = ads.slice(0, 5).map(ad => {
    const ctr = ad.total_clicks > 0 ? ((ad.surveys_completed / ad.total_clicks) * 100).toFixed(1) : '0.0';
    return `
      <tr style="border-bottom:1px solid #374151;">
        <td style="padding:10px 12px;color:#f9fafb;font-weight:600;">${ad.brand_name}</td>
        <td style="padding:10px 12px;color:#9ca3af;">${ad.status}</td>
        <td style="padding:10px 12px;color:#60a5fa;">${ad.total_clicks || 0}</td>
        <td style="padding:10px 12px;color:#34d399;">${ad.surveys_completed || 0}</td>
        <td style="padding:10px 12px;color:#f59e0b;">${ctr}%</td>
        <td style="padding:10px 12px;color:#f87171;">$${(ad.total_spent || 0).toFixed(2)}</td>
      </tr>`;
  }).join('');

  const dashboardUrl = 'https://gamergain.app/AdBusinessDashboard';

  const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:16px;padding:28px;margin-bottom:24px;text-align:center;">
      <h1 style="margin:0;color:#000;font-size:24px;font-weight:900;">📊 Weekly Ad Report</h1>
      <p style="margin:8px 0 0;color:#1c1917;font-size:14px;">GamerGain Million Dollar Ad Grid</p>
    </div>

    <p style="color:#d1d5db;font-size:15px;margin-bottom:24px;">Hi <strong style="color:#fff;">${name}</strong>, here's your weekly performance summary.</p>

    <!-- Overview stats -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px;">
      ${[
        ['Total Clicks', totalClicks, '#60a5fa'],
        ['Surveys Done', totalCompleted, '#34d399'],
        ['Avg CTR', avgCTR + '%', '#f59e0b'],
        ['Total Spent', '$' + totalSpent.toFixed(2), '#f87171'],
      ].map(([label, val, color]) => `
        <div style="background:#1f2937;border:1px solid #374151;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;color:${color};font-size:22px;font-weight:900;">${val}</p>
          <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">${label}</p>
        </div>`).join('')}
    </div>

    ${topAd ? `
    <!-- Top performing ad -->
    <div style="background:#1f2937;border:1px solid #f59e0b44;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">⭐ Top Performing Ad</p>
      <p style="margin:0;color:#fff;font-size:16px;font-weight:800;">${topAd.brand_name}</p>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${topAd.surveys_completed || 0} surveys · ${topAd.total_clicks || 0} clicks · $${(topAd.total_spent || 0).toFixed(2)} spent</p>
    </div>` : ''}

    <!-- Ad table -->
    <div style="background:#1f2937;border:1px solid #374151;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:14px 12px;border-bottom:1px solid #374151;">
        <p style="margin:0;color:#fff;font-weight:700;font-size:14px;">All Campaigns</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#111827;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Ad</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Status</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Clicks</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Done</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">CTR</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Spent</th>
          </tr>
        </thead>
        <tbody>${adsRows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;font-weight:900;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Full Dashboard →
      </a>
    </div>

    <p style="color:#4b5563;font-size:12px;text-align:center;">GamerGain · Unsubscribe from weekly reports in your dashboard settings.</p>
  </div>
</body>
</html>`;

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email,
    subject: `📊 Your Weekly Ad Report — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    body,
  });
}