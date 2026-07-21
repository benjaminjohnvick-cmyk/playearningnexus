import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch recent transactions, disputes, and user reports
    const [transactions, disputes, fraudReports] = await Promise.all([
      base44.entities.Transaction.filter({}, '-created_date', 200),
      base44.entities.DisputeClaim.filter({}, '-created_at', 50),
      base44.entities.FraudReport.filter({}, '-created_date', 30)
    ]);

    // Compliance analysis prompt
    const compliancePrompt = `Review these platform activities for compliance issues:
- Transactions (last 200): ${transactions.length}
- Disputes: ${disputes.length}
- Fraud reports: ${fraudReports.length}

Identify: 1) Patterns suggesting policy violations, 2) Regulatory red flags (age verification, KYC, AML), 3) Content moderation gaps, 4) Recommended policy updates.`;

    const complianceAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: compliancePrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          policy_violations: {
            type: 'array',
            items: { type: 'string' }
          },
          regulatory_flags: {
            type: 'array',
            items: { type: 'string' }
          },
          recommended_updates: {
            type: 'array',
            items: { type: 'string' }
          },
          urgency: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
        }
      }
    });

    // Auto-escalate critical compliance issues
    if (complianceAnalysis.urgency === 'critical') {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '⚠️ CRITICAL Compliance Alert - Immediate Review Required',
        body: `Critical compliance issues detected:\n\n${complianceAnalysis.policy_violations.join('\n')}\n\nRegulatory flags:\n${complianceAnalysis.regulatory_flags.join('\n')}`
      });
    }

    return Response.json({
      success: true,
      analysis: complianceAnalysis
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});