import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "scheduleAndProcessPayouts", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "scheduleAndProcessPayouts — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { payout_id, scheduled_date, payout_method } = await req.json();

    if (!payout_id) {
      return Response.json({ error: 'Missing payout_id' }, { status: 400 });
    }

    // Fetch payout
    const payout = await base44.entities.Payout.get(payout_id);

    if (!payout) {
      return Response.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'approved') {
      return Response.json({ error: 'Payout must be approved before scheduling' }, { status: 400 });
    }

    // Calculate optimal payout date if not provided
    const finalScheduledDate = scheduled_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days from now

    // Update payout with scheduled info
    const updatedPayout = await base44.entities.Payout.update(payout_id, {
      payout_method,
      payout_address: payout.payout_address,
      status: 'scheduled',
      scheduled_date: finalScheduledDate
    });

    // Log payout event for analytics
    await base44.analytics.track({
      eventName: 'payout_scheduled',
      properties: {
        payout_id,
        recipient_id: payout.recipient_user_id,
        amount: payout.net_payout,
        method: payout_method,
        scheduled_date: finalScheduledDate
      }
    });

    return Response.json({
      success: true,
      payout_id,
      scheduled_date: finalScheduledDate,
      net_payout: payout.net_payout,
      status: 'scheduled'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});