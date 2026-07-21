import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const report = data;
    if (!report?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI analyze the fraud report
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this fraud report on a gaming/survey platform:
Type: ${report.report_type || 'unknown'}
Description: ${report.description || ''}
Reported user: ${report.reported_user_id || 'unknown'}

Provide: confidence_score (0-100), recommended_action (warn/suspend/ban/dismiss/investigate), ai_summary (1 sentence).`,
        response_json_schema: {
          type: "object",
          properties: {
            confidence_score: { type: "number" },
            recommended_action: { type: "string" },
            ai_summary: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.FraudReport.update(report.id, {
        ai_confidence: analysis.confidence_score,
        ai_recommended_action: analysis.recommended_action,
        ai_summary: analysis.ai_summary,
        status: analysis.confidence_score >= 80 ? 'confirmed' : 'under_review'
      });

      // Auto-suspend if very high confidence
      if (analysis.confidence_score >= 90 && report.reported_user_id) {
        await base44.asServiceRole.entities.User.update(report.reported_user_id, {
          account_status: 'suspended',
          suspension_reason: `Auto-suspended: AI fraud detection (${analysis.confidence_score}% confidence) — ${analysis.ai_summary}`
        });
      }

      // Alert admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 2)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'fraud_report_new',
          title: `🚨 Fraud Report — ${analysis.confidence_score}% Confidence`,
          message: `${analysis.ai_summary} | Action: ${analysis.recommended_action}`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update' && data.status === 'resolved') {
      // Notify reporter
      if (report.reporter_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: report.reporter_user_id,
          type: 'fraud_report_resolved',
          title: '✅ Fraud Report Resolved',
          message: `Your fraud report has been reviewed and resolved. Thank you for keeping GamerGain safe!`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});