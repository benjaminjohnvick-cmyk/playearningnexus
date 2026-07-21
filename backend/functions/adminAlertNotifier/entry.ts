import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

const ADMIN_EMAIL = 'benjaminjohnvick@gmail.com';
const LARGE_WITHDRAWAL_THRESHOLD = 50; // $50+
const HIGH_VALUE_MILESTONE_THRESHOLD = 100; // $100+ total earnings

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  if (!data) return Response.json({ ok: true });

  const entityName = event?.entity_name;
  const eventType = event?.type;

  // --- LARGE WITHDRAWAL ALERT ---
  if (entityName === 'Payout' && eventType === 'create') {
    const amount = data.amount || 0;
    if (amount < LARGE_WITHDRAWAL_THRESHOLD) return Response.json({ ok: true, skipped: true });

    // Fetch user details
    let userName = data.recipient_email || 'Unknown User';
    let userBalance = 0;
    if (data.user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: data.user_id });
      if (users[0]) {
        userName = users[0].full_name || users[0].email;
        userBalance = users[0].current_balance || 0;
      }
    }

    const method = data.method || 'unknown';
    const activityLink = `https://app.base44.com/apps/your-app/data/Payout/${data.id}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject: `🚨 Large Withdrawal Request: $${amount.toFixed(2)} by ${userName}`,
      body: `
<h2>⚠️ Large Withdrawal Alert</h2>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><td><strong>User</strong></td><td>${userName}</td></tr>
  <tr><td><strong>Withdrawal Amount</strong></td><td style="color:#dc2626;font-size:18px;font-weight:bold;">$${amount.toFixed(2)}</td></tr>
  <tr><td><strong>Method</strong></td><td>${method.toUpperCase()}</td></tr>
  <tr><td><strong>Recipient</strong></td><td>${data.recipient_email || '—'}</td></tr>
  <tr><td><strong>Current Balance</strong></td><td>$${userBalance.toFixed(2)}</td></tr>
  <tr><td><strong>Status</strong></td><td>${data.status || 'pending'}</td></tr>
  <tr><td><strong>Submitted At</strong></td><td>${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
  <tr><td><strong>Activity Link</strong></td><td><a href="${activityLink}">View Payout Record</a></td></tr>
</table>
<p style="color:#6b7280;font-size:12px;">This alert was triggered automatically by GamerGain platform monitoring.</p>
      `.trim(),
    });

    return Response.json({ ok: true, alerted: 'large_withdrawal' });
  }

  // --- HIGH-VALUE MILESTONE ALERT ---
  if (entityName === 'User' && eventType === 'update') {
    const totalEarnings = data.total_earnings || 0;
    const milestones = [100, 250, 500, 1000, 2500, 5000];
    const hitMilestone = milestones.find(m => totalEarnings >= m && (body.old_data?.total_earnings || 0) < m);

    if (!hitMilestone) return Response.json({ ok: true, skipped: true });

    const userName = data.full_name || data.email || 'Unknown User';
    const activityLink = `https://app.base44.com/apps/your-app/data/User/${data.id}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject: `🏆 High-Value Milestone: ${userName} reached $${hitMilestone}`,
      body: `
<h2>🏆 High-Value Milestone Reached!</h2>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><td><strong>User</strong></td><td>${userName}</td></tr>
  <tr><td><strong>Email</strong></td><td>${data.email || '—'}</td></tr>
  <tr><td><strong>Milestone Hit</strong></td><td style="color:#16a34a;font-size:18px;font-weight:bold;">$${hitMilestone} Total Earned</td></tr>
  <tr><td><strong>Total Earnings</strong></td><td>$${totalEarnings.toFixed(2)}</td></tr>
  <tr><td><strong>Current Balance</strong></td><td>$${(data.current_balance || 0).toFixed(2)}</td></tr>
  <tr><td><strong>Triggered At</strong></td><td>${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
  <tr><td><strong>Activity Link</strong></td><td><a href="${activityLink}">View User Record</a></td></tr>
</table>
<p style="color:#6b7280;font-size:12px;">This alert was triggered automatically by GamerGain platform monitoring.</p>
      `.trim(),
    });

    return Response.json({ ok: true, alerted: 'milestone', milestone: hitMilestone });
  }

  return Response.json({ ok: true });
});