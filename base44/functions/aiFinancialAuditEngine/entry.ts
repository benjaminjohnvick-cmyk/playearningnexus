import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch financial data
    const [transactions, payouts, referralData] = await Promise.all([
      base44.entities.Transaction.filter({}, '-created_date', 300),
      base44.entities.Payout.filter({}, '-created_at', 200),
      base44.entities.Referral.filter({}, '-created_date', 500)
    ]);

    const financialSummary = {
      total_transactions: transactions.length,
      total_payouts: payouts.reduce((sum, p) => sum + (p.net_payout || 0), 0),
      total_referral_revenue: referralData.reduce((sum, r) => sum + (r.amount_earned || 0), 0),
      unique_users: new Set(referralData.map(r => r.referrer_user_id)).size
    };

    // AI audit for tax compliance and discrepancies
    const auditPrompt = `Perform a financial audit:
- Total transactions: ${financialSummary.total_transactions}
- Payouts issued: $${financialSummary.total_payouts.toFixed(2)}
- Revenue generated: $${financialSummary.total_referral_revenue.toFixed(2)}
- Active users: ${financialSummary.unique_users}

Identify: 1) Tax liability by region, 2) Discrepancies or anomalies, 3) Revenue recognition issues, 4) Compliance gaps (1099, AML, KYC), 5) Audit recommendations.`;

    const auditReport = await base44.integrations.Core.InvokeLLM({
      prompt: auditPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          tax_liabilities: { type: 'array', items: { type: 'string' } },
          discrepancies: { type: 'array', items: { type: 'string' } },
          revenue_recognition: { type: 'array', items: { type: 'string' } },
          compliance_gaps: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
        }
      }
    });

    // Alert if critical issues
    if (auditReport.risk_level === 'critical') {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '⚠️ CRITICAL Financial Audit Alert',
        body: `Critical financial issues detected:\n\n${auditReport.compliance_gaps.join('\n')}\n\nImmediate actions required:\n${auditReport.recommendations.join('\n')}`
      });
    }

    return Response.json({
      success: true,
      summary: financialSummary,
      audit_report: auditReport
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});