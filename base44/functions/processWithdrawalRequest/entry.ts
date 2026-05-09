import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Business eligibility check
    const BUSINESS_ROLES = ['admin', 'developer', 'survey_creator', 'ppc_advertiser'];
    const { amount, payment_method, payment_details, payout_type } = await req.json();

    const isBusinessRole = BUSINESS_ROLES.includes(user.role);
    const isEligiblePayoutType = ['referral_commission', 'contest_win'].includes(payout_type);
    if (!isBusinessRole && !isEligiblePayoutType) {
      return Response.json({ error: 'Forbidden: You are not eligible for cash withdrawals.' }, { status: 403 });
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