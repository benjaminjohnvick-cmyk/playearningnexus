import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ADMIN_EMAIL = 'admin@gamergain.com'; // Change to your admin email
const MILESTONES = [100, 250, 500, 1000, 2500, 5000];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all DailyEarnings records from today to find users who recently crossed a milestone
  const today = new Date().toISOString().split('T')[0];
  const recentEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({ date: today });

  let alertsSent = 0;

  for (const record of recentEarnings) {
    if (!record.user_id) continue;

    // Get all PPCTransactions to compute total for this user
    const transactions = await base44.asServiceRole.entities.PPCTransaction.filter({ user_id: record.user_id });
    const totalEarned = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    const hitMilestone = MILESTONES.find(m => {
      // Only alert if total is just above milestone (within today's earnings)
      const todayEarned = record.total_earned || 0;
      return totalEarned >= m && (totalEarned - todayEarned) < m;
    });

    if (!hitMilestone) continue;

    // Check if we already alerted for this milestone (use a Notification record as a flag)
    const existing = await base44.asServiceRole.entities.Notification.filter({
      user_id: record.user_id,
      type: 'achievement_unlocked',
      title: `ADMIN_MILESTONE_${hitMilestone}_SENT`,
    });
    if (existing.length > 0) continue;

    // Get user details from PPCTransaction (has user_id)
    const userTx = transactions[0];
    const userName = record.user_id;
    const activityLink = `https://app.base44.com/data/DailyEarnings/${record.id}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject: `🏆 Milestone Alert: User reached $${hitMilestone} in earnings`,
      body: `
<h2>🏆 High-Value Milestone Reached!</h2>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><td><strong>User ID</strong></td><td>${record.user_id}</td></tr>
  <tr><td><strong>Milestone Hit</strong></td><td style="color:#16a34a;font-size:18px;font-weight:bold;">$${hitMilestone} Total Earned</td></tr>
  <tr><td><strong>Total Earnings</strong></td><td>$${totalEarned.toFixed(2)}</td></tr>
  <tr><td><strong>Today's Earnings</strong></td><td>$${(record.total_earned || 0).toFixed(2)}</td></tr>
  <tr><td><strong>Triggered At</strong></td><td>${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
  <tr><td><strong>Activity Link</strong></td><td><a href="${activityLink}">View Earnings Record</a></td></tr>
</table>
<p style="color:#6b7280;font-size:12px;">GamerGain platform monitoring — auto-generated alert.</p>
      `.trim(),
    });

    // Mark as alerted so we don't re-send
    await base44.asServiceRole.entities.Notification.create({
      user_id: record.user_id,
      type: 'achievement_unlocked',
      title: `ADMIN_MILESTONE_${hitMilestone}_SENT`,
      message: `Admin was notified of $${hitMilestone} milestone`,
      status: 'read',
      delivery_method: ['in_app'],
    });

    alertsSent++;
  }

  return Response.json({ ok: true, alertsSent });
});