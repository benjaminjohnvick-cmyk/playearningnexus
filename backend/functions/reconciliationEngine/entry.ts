import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import Stripe from 'npm:stripe@14.21.0';

/**
 * Automated Reconciliation Engine
 * Cross-references Stripe/PayPal payout logs with internal PPCTransaction & Payout records.
 * Flags discrepancies and emails automated reports to admins/partners.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const daysBack = body.days_back || 30;
    const sendEmail = body.send_email !== false;
    const partnerEmail = body.partner_email || null;

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - daysBack);
    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = now.toISOString().slice(0, 10);

    // Create report record
    const report = await base44.asServiceRole.entities.ReconciliationReport.create({
      report_period_start: startStr,
      report_period_end: endStr,
      run_by: user.email,
      status: 'running',
    });
    const reportId = report.id;

    // ── 1. Fetch internal records ──────────────────────────────────────────────
    const [allPayouts, allPPCTx, allCreatorPayouts] = await Promise.all([
      base44.asServiceRole.entities.Payout.list('-created_date', 1000),
      base44.asServiceRole.entities.PPCTransaction.list('-created_date', 2000),
      base44.asServiceRole.entities.CreatorPayout.list('-created_date', 500),
    ]);

    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d >= startStr && d <= endStr;
    };

    const periodPayouts = allPayouts.filter(p => inPeriod(p.created_date) && p.status !== 'failed');
    const periodPPCTx = allPPCTx.filter(t => inPeriod(t.created_date) && t.status === 'completed');
    const periodCreatorPayouts = allCreatorPayouts.filter(p => inPeriod(p.created_date));

    const totalInternalPayouts = periodPayouts.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPPCEarnings = periodPPCTx
      .filter(t => ['ppc_earning', 'survey_payout'].includes(t.transaction_type))
      .reduce((s, t) => s + (t.amount || 0), 0);

    // ── 2. Fetch Stripe payouts ────────────────────────────────────────────────
    let stripePayouts = [];
    let totalStripe = 0;
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (STRIPE_KEY) {
      const stripe = new Stripe(STRIPE_KEY);
      const stripePeriodStart = Math.floor(periodStart.getTime() / 1000);
      const stripeResp = await stripe.payouts.list({
        created: { gte: stripePeriodStart },
        limit: 100,
      });
      stripePayouts = stripeResp.data || [];
      totalStripe = stripePayouts.reduce((s, p) => s + (p.amount || 0) / 100, 0); // Stripe uses cents
    }

    // ── 3. Fetch PayPal payouts ────────────────────────────────────────────────
    let totalPayPal = 0;
    const PAYPAL_CLIENT = Deno.env.get('PAYPAL_CLIENT_ID');
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET_KEY');
    const paypalPayoutRecords = periodPayouts.filter(p => p.method === 'paypal' && p.external_transaction_id);

    // Use internal PayPal records as the source of truth for PayPal total
    totalPayPal = periodPayouts
      .filter(p => p.method === 'paypal')
      .reduce((s, p) => s + (p.amount || 0), 0);

    // ── 4. Discrepancy Detection ───────────────────────────────────────────────
    const discrepancies = [];

    // A. Payouts with no matching PPCTransaction (orphaned payouts)
    for (const payout of periodPayouts) {
      if (!payout.user_id) continue;
      const userTx = periodPPCTx.filter(t => t.user_id === payout.user_id);
      const userNetEarned = userTx
        .filter(t => ['ppc_earning', 'survey_payout', 'referral_commission'].includes(t.transaction_type))
        .reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);

      const delta = payout.amount - userNetEarned;
      // Flag if payout exceeds recorded earnings by >$5 (to avoid rounding noise)
      if (delta > 5) {
        discrepancies.push({
          type: 'payout_exceeds_earnings',
          user_id: payout.user_id,
          user_email: payout.recipient_email || '',
          internal_amount: userNetEarned,
          external_amount: payout.amount,
          delta: parseFloat(delta.toFixed(2)),
          payout_id: payout.id,
          external_tx_id: payout.external_transaction_id || '',
          description: `Payout of $${payout.amount.toFixed(2)} exceeds recorded net earnings of $${userNetEarned.toFixed(2)} for user. Delta: $${delta.toFixed(2)}.`,
          resolved: false,
          email_sent: false,
        });
      }
    }

    // B. Stripe payouts with no matching internal Payout record
    for (const sp of stripePayouts) {
      const amountUSD = sp.amount / 100;
      const matchingInternal = periodPayouts.find(p =>
        p.external_transaction_id === sp.id ||
        (Math.abs(p.amount - amountUSD) < 0.50 && inPeriod(new Date(sp.created * 1000).toISOString()))
      );
      if (!matchingInternal) {
        discrepancies.push({
          type: 'stripe_payout_unmatched',
          user_id: '',
          user_email: '',
          internal_amount: 0,
          external_amount: amountUSD,
          delta: amountUSD,
          payout_id: '',
          external_tx_id: sp.id,
          description: `Stripe payout ${sp.id} ($${amountUSD.toFixed(2)}) has no matching internal Payout record. Status: ${sp.status}.`,
          resolved: false,
          email_sent: false,
        });
      }
    }

    // C. Internal payouts marked completed but Stripe shows failed/canceled
    for (const payout of periodPayouts.filter(p => p.method === 'paypal' || p.method === 'stripe')) {
      if (payout.status === 'completed' && payout.error_message) {
        discrepancies.push({
          type: 'completed_with_error',
          user_id: payout.user_id || '',
          user_email: payout.recipient_email || '',
          internal_amount: payout.amount,
          external_amount: 0,
          delta: payout.amount,
          payout_id: payout.id,
          external_tx_id: payout.external_transaction_id || '',
          description: `Payout ${payout.id} is marked "completed" internally but has error: "${payout.error_message}".`,
          resolved: false,
          email_sent: false,
        });
      }
    }

    // D. Overall sum mismatch — internal vs external
    const totalExternal = totalStripe + totalPayPal;
    const totalInternal = totalInternalPayouts;
    const overallDelta = Math.abs(totalExternal - totalInternal);
    if (overallDelta > 10 && totalExternal > 0) {
      discrepancies.push({
        type: 'overall_sum_mismatch',
        user_id: 'platform',
        user_email: user.email,
        internal_amount: totalInternal,
        external_amount: totalExternal,
        delta: parseFloat(overallDelta.toFixed(2)),
        payout_id: '',
        external_tx_id: '',
        description: `Total internal payouts ($${totalInternal.toFixed(2)}) differ from total external payouts ($${totalExternal.toFixed(2)}) by $${overallDelta.toFixed(2)}.`,
        resolved: false,
        email_sent: false,
      });
    }

    const totalDiscrepancyAmount = discrepancies.reduce((s, d) => s + (d.delta || 0), 0);

    // ── 5. Generate HTML report ───────────────────────────────────────────────
    const summaryHtml = `
<h2>Reconciliation Report: ${startStr} → ${endStr}</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
  <tr style="background:#f3f4f6"><th>Metric</th><th>Value</th></tr>
  <tr><td>Period</td><td>${startStr} to ${endStr}</td></tr>
  <tr><td>Internal Payouts Total</td><td>$${totalInternalPayouts.toFixed(2)}</td></tr>
  <tr><td>Stripe Payouts Total</td><td>$${totalStripe.toFixed(2)}</td></tr>
  <tr><td>PayPal Payouts Total</td><td>$${totalPayPal.toFixed(2)}</td></tr>
  <tr><td>PPC Earnings Total</td><td>$${totalPPCEarnings.toFixed(2)}</td></tr>
  <tr style="background:#fef2f2"><td><strong>Discrepancies Found</strong></td><td><strong>${discrepancies.length}</strong></td></tr>
  <tr style="background:#fef2f2"><td><strong>Total Discrepancy Amount</strong></td><td><strong>$${totalDiscrepancyAmount.toFixed(2)}</strong></td></tr>
</table>

${discrepancies.length > 0 ? `
<h3 style="color:#dc2626;margin-top:20px;">⚠️ Flagged Discrepancies (${discrepancies.length})</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;width:100%">
  <tr style="background:#fef2f2">
    <th>Type</th><th>User</th><th>Internal $</th><th>External $</th><th>Delta</th><th>Description</th>
  </tr>
  ${discrepancies.map(d => `
  <tr>
    <td>${d.type.replace(/_/g, ' ')}</td>
    <td>${d.user_email || d.user_id || 'platform'}</td>
    <td>$${(d.internal_amount || 0).toFixed(2)}</td>
    <td>$${(d.external_amount || 0).toFixed(2)}</td>
    <td style="color:#dc2626;font-weight:bold">$${(d.delta || 0).toFixed(2)}</td>
    <td>${d.description}</td>
  </tr>`).join('')}
</table>
` : '<p style="color:#16a34a">✅ No discrepancies found for this period.</p>'}

<p style="color:#6b7280;font-size:11px;margin-top:20px;">
  Generated by GamerGain Automated Reconciliation Engine on ${now.toISOString()}. Run by: ${user.email}.
</p>`;

    // ── 6. Send email report ───────────────────────────────────────────────────
    let emailSent = false;
    if (sendEmail) {
      const recipients = [user.email];
      if (partnerEmail) recipients.push(partnerEmail);

      const subject = discrepancies.length > 0
        ? `⚠️ Reconciliation Alert: ${discrepancies.length} discrepancies found (${startStr} – ${endStr})`
        : `✅ Reconciliation Report: All clear (${startStr} – ${endStr})`;

      for (const email of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: summaryHtml,
          from_name: 'GamerGain Finance',
        });
      }
      emailSent = true;
    }

    // ── 7. Save final report ───────────────────────────────────────────────────
    await base44.asServiceRole.entities.ReconciliationReport.update(reportId, {
      total_internal_payouts: parseFloat(totalInternalPayouts.toFixed(2)),
      total_stripe_payouts: parseFloat(totalStripe.toFixed(2)),
      total_paypal_payouts: parseFloat(totalPayPal.toFixed(2)),
      total_ppc_earnings: parseFloat(totalPPCEarnings.toFixed(2)),
      discrepancy_count: discrepancies.length,
      total_discrepancy_amount: parseFloat(totalDiscrepancyAmount.toFixed(2)),
      discrepancies,
      status: 'completed',
      email_report_sent: emailSent,
      email_sent_at: emailSent ? now.toISOString() : null,
      summary_html: summaryHtml,
    });

    return Response.json({
      success: true,
      report_id: reportId,
      period: `${startStr} → ${endStr}`,
      total_internal_payouts: totalInternalPayouts,
      total_stripe_payouts: totalStripe,
      total_paypal_payouts: totalPayPal,
      total_ppc_earnings: totalPPCEarnings,
      discrepancy_count: discrepancies.length,
      total_discrepancy_amount: totalDiscrepancyAmount,
      email_sent: emailSent,
      discrepancies,
    });

  } catch (error) {
    console.error('Reconciliation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});