import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ADMIN_EMAIL = 'benjaminjohnvick@gmail.com';

// Thresholds
const RAPID_PAYOUT_WINDOW_HOURS = 24;
const RAPID_PAYOUT_COUNT_THRESHOLD = 3;         // 3+ payouts in 24h = suspicious
const MIN_SECONDS_PER_SURVEY = 30;              // completing a survey in < 30s is suspicious
const HIGH_SPEED_SURVEY_THRESHOLD = 5;          // 5+ suspiciously fast surveys = flag

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  if (!data || event?.entity_name !== 'Payout' || event?.type !== 'create') {
    return Response.json({ ok: true, skipped: true });
  }

  const userId = data.user_id;
  if (!userId) return Response.json({ ok: true, skipped: 'no_user_id' });

  const flags = [];
  const now = new Date();

  // ── 1. RAPID-FIRE PAYOUTS ─────────────────────────────────────────────────
  const allPayouts = await base44.asServiceRole.entities.Payout.filter({ user_id: userId });
  const windowStart = new Date(now - RAPID_PAYOUT_WINDOW_HOURS * 60 * 60 * 1000);
  const recentPayouts = allPayouts.filter(p => new Date(p.created_date) >= windowStart);

  if (recentPayouts.length >= RAPID_PAYOUT_COUNT_THRESHOLD) {
    flags.push({
      type: 'rapid_fire_payouts',
      severity: 'high',
      detail: `${recentPayouts.length} payouts submitted within ${RAPID_PAYOUT_WINDOW_HOURS}h. Amounts: ${recentPayouts.map(p => '$' + (p.amount || 0).toFixed(2)).join(', ')}`,
    });
  }

  // ── 2. UNUSUALLY HIGH SURVEY COMPLETION SPEED ────────────────────────────
  const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: userId });
  const fastResponses = responses.filter(r => r.time_taken_seconds && r.time_taken_seconds < MIN_SECONDS_PER_SURVEY);

  if (fastResponses.length >= HIGH_SPEED_SURVEY_THRESHOLD) {
    flags.push({
      type: 'high_speed_survey_completion',
      severity: 'medium',
      detail: `${fastResponses.length} surveys completed in under ${MIN_SECONDS_PER_SURVEY}s. Fastest: ${Math.min(...fastResponses.map(r => r.time_taken_seconds))}s`,
    });
  }

  // ── 3. MULTIPLE ACCOUNTS SAME IP (detect via UserActivity) ───────────────
  const userActivities = await base44.asServiceRole.entities.UserActivity.filter({ user_id: userId });
  const userIPs = [...new Set(userActivities.map(a => a.ip_address).filter(Boolean))];

  if (userIPs.length > 0) {
    // Find other users who share any of these IPs
    const sharedIPUsers = new Set();
    for (const ip of userIPs) {
      const others = await base44.asServiceRole.entities.UserActivity.filter({ ip_address: ip });
      others.forEach(a => { if (a.user_id && a.user_id !== userId) sharedIPUsers.add(a.user_id); });
    }
    if (sharedIPUsers.size > 0) {
      flags.push({
        type: 'shared_ip_multiple_accounts',
        severity: 'high',
        detail: `IP(s) ${userIPs.join(', ')} also used by ${sharedIPUsers.size} other account(s): ${[...sharedIPUsers].join(', ')}`,
      });
    }
  }

  // ── 4. ABNORMALLY HIGH SINGLE PAYOUT ─────────────────────────────────────
  const avgPayout = allPayouts.length > 1
    ? allPayouts.reduce((s, p) => s + (p.amount || 0), 0) / allPayouts.length
    : 0;
  if (avgPayout > 0 && data.amount > avgPayout * 5) {
    flags.push({
      type: 'abnormal_payout_amount',
      severity: 'medium',
      detail: `Current payout $${data.amount.toFixed(2)} is ${(data.amount / avgPayout).toFixed(1)}x the user's average payout of $${avgPayout.toFixed(2)}`,
    });
  }

  if (flags.length === 0) return Response.json({ ok: true, clean: true });

  // ── LOG TO FraudReport ────────────────────────────────────────────────────
  const highestSeverity = flags.some(f => f.severity === 'high') ? 'high' : 'medium';

  const fraudRecord = await base44.asServiceRole.entities.FraudReport.create({
    reported_user_id: userId,
    trigger_entity: 'Payout',
    trigger_entity_id: data.id,
    flags: flags,
    flag_count: flags.length,
    severity: highestSeverity,
    status: 'pending_review',
    payout_amount: data.amount,
    payout_method: data.method,
    notes: flags.map(f => `[${f.type.toUpperCase()}] ${f.detail}`).join('\n'),
  });

  // ── EMAIL ADMIN ───────────────────────────────────────────────────────────
  const flagRows = flags.map(f =>
    `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">
        <span style="background:${f.severity === 'high' ? '#fee2e2' : '#fef9c3'};color:${f.severity === 'high' ? '#dc2626' : '#92400e'};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:bold;">
          ${f.severity.toUpperCase()}
        </span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${f.type.replace(/_/g, ' ')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#374151;">${f.detail}</td>
    </tr>`
  ).join('');

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: ADMIN_EMAIL,
    subject: `🚩 Fraud Alert [${highestSeverity.toUpperCase()}]: Suspicious activity on payout $${data.amount?.toFixed(2)} — User ${userId}`,
    body: `
<h2>🚩 Fraud Detection Alert</h2>
<p><strong>User ID:</strong> ${userId} &nbsp;|&nbsp; <strong>Payout Amount:</strong> $${(data.amount || 0).toFixed(2)} &nbsp;|&nbsp; <strong>Method:</strong> ${(data.method || '—').toUpperCase()}</p>
<p><strong>Flags Detected:</strong> ${flags.length} &nbsp;|&nbsp; <strong>Overall Severity:</strong> 
  <span style="color:${highestSeverity === 'high' ? '#dc2626' : '#d97706'};font-weight:bold;">${highestSeverity.toUpperCase()}</span>
</p>
<table width="100%" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#f3f4f6;">
      <th style="padding:8px 10px;text-align:left;">Severity</th>
      <th style="padding:8px 10px;text-align:left;">Flag Type</th>
      <th style="padding:8px 10px;text-align:left;">Detail</th>
    </tr>
  </thead>
  <tbody>${flagRows}</tbody>
</table>
<br/>
<p><strong>FraudReport ID:</strong> ${fraudRecord.id}</p>
<p style="color:#6b7280;font-size:12px;">Review this in your admin dashboard under Fraud Reports. Triggered at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.</p>
    `.trim(),
  });

  return Response.json({ ok: true, flagged: true, flagCount: flags.length, severity: highestSeverity, fraudReportId: fraudRecord.id });
});