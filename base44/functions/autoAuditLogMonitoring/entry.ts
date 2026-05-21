import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-analyzes audit logs and flags anomalies for admin review
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Compute date range up front so they're always defined
    const todayDate = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Get recent audit logs from last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logs = await base44.asServiceRole.entities.AdminAuditLog.list('-created_date', 200);
    const recentLogs = logs.filter(l => l.created_date > yesterday);

    if (recentLogs.length === 0) return Response.json({ success: true, message: 'No recent logs to analyze' });

    const { InvokeLLM } = base44.asServiceRole.integrations.Core;

    const summary = await InvokeLLM({
      prompt: `Analyze these admin audit log entries from the last 24 hours and identify any anomalies or security concerns:

${recentLogs.slice(0, 50).map(l => `[${l.created_date}] ${l.action || l.event_type}: ${l.description || l.details || ''}`).join('\n')}

Total entries: ${recentLogs.length}

Identify:
1. Unusual high-volume actions
2. Suspicious user behavior patterns  
3. Failed auth attempts
4. Bulk data access or modifications
5. Off-hours admin activity

Respond with JSON: { "anomalies_found": boolean, "severity": "low" | "medium" | "high", "summary": "string", "action_required": boolean }`,
      response_json_schema: {
        type: 'object',
        properties: {
          anomalies_found: { type: 'boolean' },
          severity: { type: 'string' },
          summary: { type: 'string' },
          action_required: { type: 'boolean' },
        }
      }
    });

    // Create a ReconciliationReport entry with the findings
    await base44.asServiceRole.entities.ReconciliationReport.create({
      report_period_start: yesterdayDate,
      report_period_end: todayDate,
      status: 'completed',
      summary_html: `<b>Severity:</b> ${summary.severity}<br><b>Anomalies Found:</b> ${summary.anomalies_found}<br><b>Action Required:</b> ${summary.action_required}<br><b>Logs Analyzed:</b> ${recentLogs.length}<br><br>${summary.summary}`,
    });

    // Email admin if high severity
    if (summary.action_required || summary.severity === 'high') {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        if (admin.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `🔴 GamerGain Security Alert: Audit Log Anomaly Detected`,
            body: `Daily audit log analysis found concerns:\n\nSeverity: ${summary.severity}\n\n${summary.summary}\n\nPlease review the admin audit dashboard.`,
          });
        }
      }
    }

    return Response.json({ success: true, ...summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});