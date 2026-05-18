import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily: AI analysis of AdminAuditLog for anomalies and security threats
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logs = await base44.asServiceRole.entities.AdminAuditLog.list('-created_date', 200);
    const recentLogs = logs.filter(l => l.created_date >= oneDayAgo);

    if (recentLogs.length === 0) return Response.json({ ok: true, message: 'No recent logs' });

    // Group actions
    const actionCounts = {};
    const userActions = {};
    for (const log of recentLogs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      if (log.admin_user_id) {
        userActions[log.admin_user_id] = (userActions[log.admin_user_id] || 0) + 1;
      }
    }

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze admin audit log for security anomalies:
Total actions (24h): ${recentLogs.length}
Action breakdown: ${JSON.stringify(actionCounts)}
High-activity admins: ${JSON.stringify(Object.entries(userActions).sort((a, b) => b[1] - a[1]).slice(0, 5))}

Identify: anomalies (array of concerns), risk_level (low/medium/high), recommended_actions (array), summary (one sentence)`,
      response_json_schema: {
        type: 'object',
        properties: {
          anomalies: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string' },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      }
    });

    if (analysis.risk_level !== 'low' || analysis.anomalies.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'audit_security_alert',
          title: `🔒 Audit Alert [${analysis.risk_level.toUpperCase()}]: ${analysis.anomalies.length} Anomaly(ies)`,
          message: `${analysis.summary} Actions: ${analysis.recommended_actions.slice(0, 2).join('; ')}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true, risk_level: analysis.risk_level, anomalies: analysis.anomalies.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});