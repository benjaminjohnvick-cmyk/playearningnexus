import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "requestManualPayout", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "requestManualPayout — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, method, notes } = await req.json();
    if (!amount || amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });

    // Check for existing pending manual payout
    const existing = await base44.entities.Payout.filter({ user_id: user.id, status: 'pending', payout_type: 'manual' });
    if (existing.length) {
      return Response.json({ error: 'You already have a pending manual payout request.' }, { status: 409 });
    }

    // Get payout preference for method
    const prefs = await base44.entities.PayoutPreference.filter({ user_id: user.id });
    const pref = prefs[0];
    const payoutMethod = method || pref?.payout_method || 'paypal';

    const payout = await base44.entities.Payout.create({
      user_id: user.id,
      amount,
      payout_type: 'manual',
      method: payoutMethod,
      status: 'pending',
      description: `Manual payout request${notes ? ': ' + notes : ''}`,
      recipient_email: pref?.paypal_email || '',
      notes: notes || '',
    });

    return Response.json({ success: true, payout_id: payout.id, amount, method: payoutMethod });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});