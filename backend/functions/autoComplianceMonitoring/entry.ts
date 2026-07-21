import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Monitor for compliance violations
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      created_date: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    });

    const violations = [];

    for (const tx of transactions) {
      const txUser = await base44.asServiceRole.entities.User.get(tx.user_id);

      // Flag suspicious patterns
      const dayTotal = transactions
        .filter(t => t.user_id === tx.user_id)
        .reduce((sum, t) => sum + t.amount, 0);

      // Violation 1: Excessive daily earnings (wash trading)
      if (dayTotal > 10000) {
        violations.push({
          type: 'excessive_daily_earnings',
          user_id: tx.user_id,
          amount: dayTotal,
          severity: 'high'
        });
      }

      // Violation 2: Unusual payout patterns
      if (tx.transaction_type === 'payout' && tx.amount % 1000 === 0) {
        // Round number payouts suspicious
        violations.push({
          type: 'round_payout',
          user_id: tx.user_id,
          amount: tx.amount,
          severity: 'medium'
        });
      }
    }

    // Create compliance report
    if (violations.length > 0) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        action: 'compliance_violations_detected',
        details: violations,
        flagged_count: violations.length,
        created_by: 'compliance_monitor'
      });

      // Notify compliance team
      await base44.integrations.Core.SendEmail({
        to: 'compliance@gamergain.com',
        subject: `⚠️ Compliance Issues Detected: ${violations.length} violations`,
        body: `${violations.length} compliance violations detected and logged for review.`
      });
    }

    return Response.json({ success: true, violations_detected: violations.length, violations });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});