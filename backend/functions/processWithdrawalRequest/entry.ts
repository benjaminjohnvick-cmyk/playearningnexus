import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isPartnerPayout } from "../../sdk/payout-policy.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "processWithdrawalRequest", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "processWithdrawalRequest — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Closed-loop eligibility: cash only for business partners (shared policy)
    const { amount, payment_method, payment_details, payout_type } = await req.json();

    if (!isPartnerPayout({ role: user?.role, payout_type })) {
      return Response.json({
        blocked: true, closed_loop: true,
        message: 'Closed-loop platform: user earnings remain as on-site store credit and cannot be cashed out. Only business-partner revenue shares are paid in cash.',
      }, { status: 200 });
    }

    if (!amount || !payment_method) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify developer has sufficient balance
    const payouts = await base44.asServiceRole.entities.DeveloperPayout.filter({
      developer_id: user.id,
      status: 'processed'
    });

    const totalAvailable = payouts.reduce((sum, p) => sum + (p.net_payout_amount || 0), 0);
    const totalWithdrawn = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      developer_id: user.id,
      status: 'completed'
    }).then(reqs => reqs.reduce((sum, r) => sum + (r.amount || 0), 0));

    const availableBalance = totalAvailable - totalWithdrawn;

    if (amount > availableBalance) {
      return Response.json(
        { error: 'Insufficient balance', availableBalance },
        { status: 400 }
      );
    }

    // Create withdrawal request with verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const withdrawal = await base44.asServiceRole.entities.WithdrawalRequest.create({
      developer_id: user.id,
      amount,
      available_balance: availableBalance,
      payment_method,
      payment_details: {
        encrypted: true,
        method: payment_method
      },
      status: 'pending',
      verification_code: verificationCode,
      verification_code_expires: verificationExpires,
      requested_at: new Date().toISOString()
    });

    // Send verification email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: 'Withdrawal Verification Required',
      body: `Your withdrawal request for $${amount.toFixed(2)} requires verification.\n\nVerification Code: ${verificationCode}\n\nThis code expires in 15 minutes.`
    });

    return Response.json({
      success: true,
      withdrawal_id: withdrawal.id,
      message: 'Verification code sent to your email',
      amount,
      available_balance: availableBalance
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});