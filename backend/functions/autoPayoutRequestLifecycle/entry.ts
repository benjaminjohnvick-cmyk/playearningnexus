import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { releaseReservation } from "../../sdk/payout-reservation.ts";
import { isPartnerUserId } from "../../sdk/payout-policy.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoPayoutRequestLifecycle", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoPayoutRequestLifecycle — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type === 'create') {
      const pr = data;
      if (!pr?.id) return Response.json({ ok: true });

      // Closed-loop wall: only a verified business PARTNER can ever be auto-approved for a cash payout.
      // A regular user's request is left as store credit (blocked), never auto-approved into the cash flow.
      if (!(await isPartnerUserId(pr.user_id))) {
        await base44.asServiceRole.entities.PayoutRequest.update(pr.id, {
          status: 'blocked_closed_loop',
          review_notes: 'Closed-loop: not a business partner; earnings remain as on-site store credit.',
        }).catch(() => null);
        return Response.json({ ok: true, closed_loop: true });
      }

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
      } else if (pr.status === 'rejected' || pr.status === 'failed' || pr.status === 'cancelled') {
        // Release the reserved hold — the money never left (rejected/failed/cancelled), so restore it to
        // available balance. Re-read the CURRENT record (not the event payload, which can be stale or
        // duplicated) and set the released flag BEFORE releasing, so a duplicate event can't double-release.
        const cur = (await base44.asServiceRole.entities.PayoutRequest.filter({ id: pr.id }))[0];
        if (cur && !cur.reservation_released) {
          await base44.asServiceRole.entities.PayoutRequest.update(pr.id, { reservation_released: true }).catch(() => null);
          await releaseReservation(base44, pr.user_id, Number(pr.amount) || 0).catch(() => null);
        }
        const reason = pr.status === 'rejected'
          ? `Reason: ${pr.rejection_reason || 'Policy violation'}. Please contact support if you believe this is an error.`
          : `The payment didn't go through, so the funds have been returned to your available balance. You can request it again.`;
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: pr.status === 'rejected' ? '❌ Payout Request Rejected' : '↩️ Payout Returned to Your Balance',
          body: `Your payout request of $${pr.amount} was ${pr.status}. ${reason}`
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