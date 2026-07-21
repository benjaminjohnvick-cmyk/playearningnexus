import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type === 'create') {
      const pr = data;
      if (!pr?.id) return Response.json({ ok: true });

      // AI fraud check on new payout request
      const user = pr.user_id ? (await base44.asServiceRole.entities.User.filter({ id: pr.user_id }))[0] : null;
      const recentPayouts = await base44.asServiceRole.entities.PayoutRequest.filter({ user_id: pr.user_id });
      const last24h = recentPayouts.filter(p => new Date(p.created_date) > new Date(Date.now() - 86400000));

      let fraudRisk = 'low';
      let autoApprove = true;
      const flags = [];

      if (last24h.length > 3) { fraudRisk = 'high'; autoApprove = false; flags.push('Multiple requests in 24h'); }
      if (pr.amount > 500) { fraudRisk = 'medium'; autoApprove = false; flags.push('Large amount review required'); }
      if (!user?.email) { fraudRisk = 'high'; autoApprove = false; flags.push('Unverified user'); }

      if (autoApprove && pr.amount <= 100 && fraudRisk === 'low') {
        await base44.asServiceRole.entities.PayoutRequest.update(pr.id, { status: 'approved', auto_approved: true });
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '✅ Payout Request Auto-Approved',
            body: `Your payout request of $${pr.amount} has been automatically approved and will be processed within 24 hours.`
          });
        }
      } else {
        await base44.asServiceRole.entities.PayoutRequest.update(pr.id, {
          status: 'pending_review',
          fraud_flags: flags,
          fraud_risk_level: fraudRisk
        });
        // Create admin support ticket
        await base44.asServiceRole.entities.SupportTicket.create({
          subject: `Payout Review Required: $${pr.amount} — Risk: ${fraudRisk.toUpperCase()}`,
          description: `User ${pr.user_id} requested $${pr.amount}. Flags: ${flags.join(', ')}. Manual review needed.`,
          status: 'open',
          priority: fraudRisk === 'high' ? 'urgent' : 'medium',
          category: 'payout_review',
          user_id: pr.user_id
        });
      }
    }

    if (event?.type === 'update') {
      const pr = data;
      if (!pr?.id || !pr?.user_id) return Response.json({ ok: true });

      const user = (await base44.asServiceRole.entities.User.filter({ id: pr.user_id }))[0];
      if (!user?.email) return Response.json({ ok: true });

      if (pr.status === 'approved') {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '💸 Payout Approved!',
          body: `Great news! Your payout of $${pr.amount} has been approved and will arrive via ${pr.method || 'PayPal'} within 1-3 business days.`
        });
      } else if (pr.status === 'rejected') {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '❌ Payout Request Rejected',
          body: `Your payout request of $${pr.amount} was rejected. Reason: ${pr.rejection_reason || 'Policy violation'}. Please contact support if you believe this is an error.`
        });
      } else if (pr.status === 'completed') {
        await base44.asServiceRole.entities.Notification.create({
          user_id: pr.user_id,
          type: 'payout_completed',
          title: '💰 Payout Sent!',
          message: `$${pr.amount} has been sent to your ${pr.method || 'PayPal'} account!`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});