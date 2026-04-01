import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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