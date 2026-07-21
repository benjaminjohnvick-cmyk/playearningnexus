import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Admin Audit Log Analyzer (#20)
 * Scheduled daily: AI scans recent admin audit logs for anomalies,
 * unusual access patterns, or potential security concerns and alerts admins.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.AdminAuditLog.list('-created_date', 500);
    const todayLogs = recentLogs.filter(l => l.created_date >= since);

    if (todayLogs.length === 0) {
      return Response.json({ success: true, logs_analyzed: 0, anomalies: 0 });
    }

    // Group by user
    const byUser = {};
    for (const log of todayLogs) {
      const uid = log.admin_user_id || log.user_id || 'unknown';
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(log);
    }

    // Detect simple anomalies pre-AI
    const flags = [];
    for (const [uid, logs] of Object.entries(byUser)) {
      if (logs.length > 50) flags.push(`User ${uid} performed ${logs.length} admin actions in 24h`);
      const deletions = logs.filter(l => (l.action || '').toLowerCase().includes('delete'));
      if (deletions.length > 10) flags.push(`User ${uid} performed ${deletions.length} deletion actions`);
      const payoutActions = logs.filter(l => (l.action || '').toLowerCase().includes('payout'));
      if (payoutActions.length > 15) flags.push(`User ${uid} triggered ${payoutActions.length} payout-related actions`);
    }

    // AI analysis
    const logSample = todayLogs.slice(0, 100).map(l =>
      `[${l.created_date?.slice(0, 16)}] ${l.action || l.event_type} by ${l.admin_user_id || 'unknown'} on ${l.target_entity || 'unknown'}`
    ).join('\n');

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a security AI for GamerGain. Analyze these admin audit log entries for anomalies, suspicious patterns, or security concerns.

LOGS (last 24h, ${todayLogs.length} total):
${logSample}

PRE-DETECTED FLAGS:
${flags.length > 0 ? flags.join('\n') : 'None detected by rules'}

Identify:
1. Anomalous behavior patterns
2. Potential unauthorized access or privilege abuse
3. Bulk operations that look unusual
4. Any security concerns

Return JSON: {
  "anomalies_found": number,
  "risk_level": "none|low|medium|high|critical",
  "anomaly_list": ["string"],
  "recommended_actions": ["string"],
  "summary": "string"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          anomalies_found: { type: 'number' },
          risk_level: { type: 'string' },
          anomaly_list: { type: 'array', items: { type: 'string' } },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      }
    });

    // Alert admins if risk is medium or higher
    if (['medium', 'high', 'critical'].includes(aiResult.risk_level)) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 3)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'security_alert',
          title: `🚨 Audit Alert: ${aiResult.risk_level?.toUpperCase()} risk detected`,
          message: aiResult.summary || `${aiResult.anomalies_found} anomalies found in admin logs`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/AdminAuditLogs',
          icon: 'shield-alert',
        });

        if (aiResult.risk_level === 'critical' || aiResult.risk_level === 'high') {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `🚨 GamerGain Security Alert: ${aiResult.risk_level?.toUpperCase()} risk in audit logs`,
            body: `<h2>Security Alert Detected</h2><p><strong>Risk Level:</strong> ${aiResult.risk_level}</p><p>${aiResult.summary}</p><h3>Anomalies:</h3><ul>${(aiResult.anomaly_list || []).map(a => `<li>${a}</li>`).join('')}</ul><h3>Recommended Actions:</h3><ul>${(aiResult.recommended_actions || []).map(a => `<li>${a}</li>`).join('')}</ul>`,
            from_name: 'GamerGain Security'
          }).catch(() => {});
        }
      }
    }

    return Response.json({
      success: true,
      logs_analyzed: todayLogs.length,
      pre_flagged: flags.length,
      anomalies: aiResult.anomalies_found,
      risk_level: aiResult.risk_level,
      summary: aiResult.summary,
      anomaly_list: aiResult.anomaly_list,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});