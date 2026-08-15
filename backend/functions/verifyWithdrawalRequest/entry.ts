import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { isPartnerUserId } from "../../sdk/payout-policy.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "verifyWithdrawalRequest", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "verifyWithdrawalRequest — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { withdrawal_id, verification_code } = await req.json();

    if (!withdrawal_id || !verification_code) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get withdrawal request
    const withdrawal = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      id: withdrawal_id
    }).then(reqs => reqs[0]);

    if (!withdrawal) {
      return Response.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    if (withdrawal.developer_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Closed-loop wall: only a verified business PARTNER (e.g. developer) can approve a cash withdrawal.
    // A regular user is closed-loop — their earnings stay as on-site store credit and can't be verified out.
    if (!(await isPartnerUserId(user.id))) {
      return Response.json({ closed_loop: true, error: 'Closed-loop: cash withdrawals are for business partners only; your earnings remain as on-site store credit.' }, { status: 403 });
    }

    // Check code expiration
    if (new Date(withdrawal.verification_code_expires) < new Date()) {
      return Response.json({ error: 'Verification code expired' }, { status: 400 });
    }

    // Verify code
    if (withdrawal.verification_code !== verification_code) {
      return Response.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Update withdrawal status to approved
    const updated = await base44.asServiceRole.entities.WithdrawalRequest.update(
      withdrawal_id,
      {
        status: 'approved',
        verified_at: new Date().toISOString()
      }
    );

    return Response.json({
      success: true,
      message: 'Withdrawal verified and approved',
      withdrawal_id,
      status: 'approved'
    });
  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});