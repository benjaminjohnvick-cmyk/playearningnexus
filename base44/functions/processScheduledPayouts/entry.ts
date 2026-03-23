import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { user_id, amount, method, send_email } = body;

    // Only allow users to trigger their own payouts (or admin for any)
    if (user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const prefs = await base44.entities.PayoutPreference.filter({ user_id });
    const pref = prefs[0];

    if (!pref) {
      return Response.json({ error: 'No payout preferences found. Please configure payout settings first.' }, { status: 400 });
    }

    const threshold = pref.minimum_payout_threshold || 50;
    if (amount < threshold) {
      return Response.json({ error: `Amount $${amount} is below threshold $${threshold}` }, { status: 400 });
    }

    const recipientEmail = pref.paypal_email || user.email;

    // Create a Payout record
    const payout = await base44.entities.Payout.create({
      user_id,
      recipient_type: 'user',
      recipient_id: user_id,
      recipient_email: recipientEmail,
      amount,
      currency: 'USD',
      method: method || pref.payout_method || 'paypal',
      payout_type: 'referral_commission',
      status: 'pending',
      description: `Auto-payout triggered: threshold $${threshold} reached`,
    });

    // Send confirmation email
    if (send_email !== false) {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `💰 Your payout of $${amount.toFixed(2)} has been requested!`,
        body: `
Hi ${user.full_name || 'there'},

Great news! Your payout of <strong>$${amount.toFixed(2)}</strong> has been submitted successfully.

<strong>Payout Details:</strong>
• Amount: $${amount.toFixed(2)}
• Method: ${method || pref.payout_method || 'PayPal'}
• Recipient: ${recipientEmail}
• Status: Pending review

Your payout will be processed within 1–5 business days depending on your selected payment method.

You can track the status in your <a href="${req.headers.get('origin') || ''}/PayoutHistory">Payout History</a>.

Thank you for being a valued GamerGain member!

— The GamerGain Team
        `.trim(),
      });
    }

    return Response.json({
      success: true,
      payout_id: payout.id,
      amount,
      method: method || pref.payout_method,
      message: 'Payout request created successfully. Email confirmation sent.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});