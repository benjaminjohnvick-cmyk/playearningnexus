import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { classifyByKeywords } from "../../sdk/rules-first.ts";

const BUG_CATEGORIES = {
  payment: ["pay", "payment", "charge", "charged", "refund", "paypal", "card", "billing", "payout", "money", "withdraw"],
  survey: ["survey", "question", "bitlabs", "ppc", "answer", "reward not"],
  auth: ["login", "log in", "password", "sign in", "signup", "account", "verify", "2fa", "locked out"],
  performance: ["slow", "lag", "freeze", "loading", "timeout", "crash", "crashes", "stuck", "hang"],
  ui: ["button", "layout", "display", "screen", "page", "click", "scroll", "text", "image", "broken link"],
};

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const report = data;
    if (!report?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // RULES FIRST (free): classify obvious, NON-critical bugs by keyword and acknowledge with a template,
      // skipping the AI. Critical or ambiguous reports still get the full AI triage (suggested fix etc.).
      const text = `${report.title || ''} ${report.description || ''} ${report.page || ''}`;
      const critical = /\b(can'?t pay|lost money|charged twice|payment failed|data ?loss|security|hacked|breach|crash(es|ed|ing)?|site (is )?down)\b/i.test(text);
      const cls = classifyByKeywords(text, BUG_CATEGORIES);
      if (!critical && cls.category && cls.confidence >= 0.5) {
        await base44.asServiceRole.entities.BugReport.update(report.id, {
          ai_category: cls.category, ai_severity: 'medium', status: 'open', triaged_via: 'rules',
        }).catch(() => null);
        if (report.user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: report.user_id, type: 'bug_report_received',
            title: '🔧 Bug Report Acknowledged',
            message: `Thanks for the report — we've logged it under "${cls.category}" and our team will take a look.`,
            is_read: false,
          }).catch(() => null);
        }
        return Response.json({ ok: true, via: 'rules', category: cls.category });
      }

      // AI triage: classify severity, suggest fix, notify dev team
      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `Triage this bug report for GamerGain gaming platform:
        Title: "${report.title || report.description?.substring(0, 80)}"
        Description: "${report.description}"
        Page/Area: "${report.page || 'unknown'}"
        
        Return: severity (critical/high/medium/low), category (ui/payment/survey/auth/performance/other), estimated_fix_time (string like "2 hours"), suggested_fix (string, 1-2 sentences), auto_response_to_user (friendly string to send to user acknowledging the bug).`,
        response_json_schema: {
          type: "object",
          properties: {
            severity: { type: "string" },
            category: { type: "string" },
            estimated_fix_time: { type: "string" },
            suggested_fix: { type: "string" },
            auto_response_to_user: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.BugReport.update(report.id, {
        ai_severity: triage.severity,
        ai_category: triage.category,
        ai_suggested_fix: triage.suggested_fix,
        status: triage.severity === 'critical' ? 'critical' : 'open'
      });

      // Auto-acknowledge reporter
      if (report.user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: report.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '🔧 Bug Report Received — Thank You!',
            body: `${triage.auto_response_to_user}\n\nSeverity: ${triage.severity.toUpperCase()} | Est. fix: ${triage.estimated_fix_time}`
          });
        }
        await base44.asServiceRole.entities.Notification.create({
          user_id: report.user_id,
          type: 'bug_report_received',
          title: '🔧 Bug Report Acknowledged',
          message: `Your report has been triaged as ${triage.severity} priority. We're on it!`,
          is_read: false
        });
      }

      // Critical bugs → create urgent support ticket
      if (triage.severity === 'critical') {
        await base44.asServiceRole.entities.SupportTicket.create({
          subject: `🚨 CRITICAL BUG: ${report.title || report.description?.substring(0, 60)}`,
          description: `${report.description}\n\nAI Analysis: ${triage.suggested_fix}`,
          status: 'open',
          priority: 'urgent',
          category: 'bug',
          user_id: report.user_id
        });
      }
    }

    if (event?.type === 'update' && data.status === 'resolved') {
      if (report.user_id) {
        const user = (await base44.asServiceRole.entities.User.filter({ id: report.user_id }))[0];
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '✅ Your bug report has been resolved!',
            body: `Great news! The issue you reported has been fixed. Thank you for helping us improve GamerGain! As a thank-you, we've added a small bonus to your account.`
          });
        }
        // Reward bug reporter
        const currentEarnings = user?.total_earnings || 0;
        await base44.asServiceRole.entities.User.update(report.user_id, {
          total_earnings: currentEarnings + 0.25
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});