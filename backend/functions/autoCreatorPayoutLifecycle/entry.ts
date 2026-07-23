import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "autoCreatorPayoutLifecycle", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "autoCreatorPayoutLifecycle — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const payout = data;
    if (!payout?.id) return Response.json({ ok: true });

    const creator = payout.creator_id ? (await base44.asServiceRole.entities.User.filter({ id: payout.creator_id }))[0] : null;

    if (event?.type === 'create') {
      if (creator?.email) {
        await base44.integrations.Core.SendEmail({
          to: creator.email,
          subject: `💰 Creator Payout of $${payout.amount} Initiated`,
          body: `Your creator earnings payout of $${payout.amount} has been initiated via ${payout.payment_method || 'PayPal'}. Processing time: 1-3 business days.`
        });
      }
      if (payout.creator_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: payout.creator_id,
          type: 'creator_payout_initiated',
          title: `💰 Creator Payout Initiated: $${payout.amount}`,
          message: `Your earnings payout of $${payout.amount} is being processed.`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = payout.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      if (newStatus === 'completed') {
        if (creator?.email) {
          await base44.integrations.Core.SendEmail({
            to: creator.email,
            subject: `✅ Creator Payout Sent: $${payout.amount}`,
            body: `Your creator payout of $${payout.amount} has been sent to your ${payout.payment_method || 'PayPal'} account. Transaction ID: ${payout.transaction_id || 'N/A'}`
          });
        }
        if (payout.creator_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: payout.creator_id,
            type: 'creator_payout_completed',
            title: `✅ Creator Payout Sent: $${payout.amount}!`,
            message: `$${payout.amount} has been sent to your account. Check your ${payout.payment_method || 'PayPal'}.`,
            is_read: false
          });
        }
      }

      if (newStatus === 'failed') {
        if (creator?.email) {
          await base44.integrations.Core.SendEmail({
            to: creator.email,
            subject: `❌ Creator Payout Failed: $${payout.amount}`,
            body: `Your creator payout of $${payout.amount} failed. Reason: ${payout.failure_reason || 'Processing error'}. Please verify your payment details and contact support.`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});