import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { payout_month, test_mode } = await req.json();
    if (!payout_month) return Response.json({ error: 'Missing payout_month (YYYY-MM)' }, { status: 400 });

    // Fetch pending payouts
    const pendingPayouts = await base44.asServiceRole.entities.PayoutRequest.filter(
      { payout_month, status: 'pending_tax_form' }, '-created_date', 100
    );

    let processed = 0, failed = 0, skipped = 0;
    const results = [];

    for (const payout of pendingPayouts) {
      try {
        // Check tax form status
        if (payout.tax_form_status !== 'verified' && payout.tax_form_status !== 'exempted') {
          // Send tax form reminder
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: payout.affiliate_email,
            from_name: 'GamerGain Payroll',
            subject: '📋 Tax Form Required for Your Monthly Payout',
            body: `Hi,\n\nYour ${payout.payout_month} payout of $${payout.net_payout_amount} is ready, but requires a completed tax form.\n\nTax Form Type: ${payout.tax_form_type}\n\nSubmit your form here: https://gamergain.app/PayoutSettings\n\nPayout will process once verified.\n\n— GamerGain Payments`
          }).catch(() => null);
          skipped++;
          continue;
        }

        // Validate referral data
        const referrals = await base44.asServiceRole.entities.Referral.filter(
          { referrer_user_id: payout.affiliate_user_id, created_date: { $gte: `${payout.payout_month}-01` } },
          '-created_date', 1000
        );
        const conversions = referrals.filter(r => r.status === 'converted').length;

        await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
          validation_data: {
            referrals_verified: referrals.length,
            conversions_verified: conversions,
            last_validation_date: new Date().toISOString(),
            validation_confidence: 95
          },
          status: 'pending_payment'
        });

        // Process payment based on method
        if (!test_mode) {
          let paymentResult;
          if (payout.payment_method === 'stripe') {
            paymentResult = await processStripePayment(payout, base44);
          } else if (payout.payment_method === 'paypal') {
            paymentResult = await processPayPalPayment(payout, base44);
          } else {
            throw new Error('Unsupported payment method');
          }

          if (paymentResult.success) {
            await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
              status: 'completed',
              transaction_id: paymentResult.transaction_id,
              processed_date: new Date().toISOString(),
              processing_notes: `Processed via ${payout.payment_method}`
            });

            // Send payout confirmation
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: payout.affiliate_email,
              from_name: 'GamerGain Payroll',
              subject: `✅ Payout Confirmed — $${payout.net_payout_amount}`,
              body: `Hi,\n\nYour ${payout.payout_month} payout has been processed!\n\nAmount: $${payout.net_payout_amount}\nMethod: ${payout.payment_method}\nTransaction ID: ${paymentResult.transaction_id}\n\nExpected arrival: 1-3 business days\n\n— GamerGain Payments`
            }).catch(() => null);

            processed++;
          } else {
            await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
              status: 'failed',
              processing_notes: paymentResult.error
            });
            failed++;
          }
        } else {
          processed++;
        }

        results.push({ id: payout.id, status: 'success', amount: payout.net_payout_amount });
      } catch (e) {
        await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
          status: 'failed',
          processing_notes: e.message
        }).catch(() => null);
        failed++;
        results.push({ id: payout.id, status: 'error', error: e.message });
      }
    }

    return Response.json({
      success: true,
      payout_month,
      total_payouts: pendingPayouts.length,
      processed,
      failed,
      skipped,
      results: results.slice(0, 10)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processStripePayment(payout, base44) {
  try {
    const stripeApiKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeApiKey) throw new Error('Stripe API key not configured');

    const response = await fetch('https://api.stripe.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: Math.round(payout.net_payout_amount * 100),
        currency: 'usd',
        description: `GamerGain Affiliate Payout ${payout.payout_month}`,
        destination: payout.payment_details?.stripe_connect_id || 'default',
        statement_descriptor: 'GAMERGAIN PAYOUT'
      })
    });

    const result = await response.json();
    if (result.id) {
      return { success: true, transaction_id: result.id };
    }
    return { success: false, error: result.error?.message || 'Stripe error' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function processPayPalPayment(payout, base44) {
  try {
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecret = Deno.env.get('PAYPAL_SECRET_KEY');
    if (!paypalClientId || !paypalSecret) throw new Error('PayPal credentials not configured');

    // Get access token
    const auth = btoa(`${paypalClientId}:${paypalSecret}`);
    const tokenResponse = await fetch('https://api.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const { access_token } = await tokenResponse.json();

    // Process payout
    const payoutResponse = await fetch('https://api.paypal.com/v1/payments/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `GG-${payout.id}`,
          email_subject: `GamerGain Payout for ${payout.payout_month}`
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: { value: payout.net_payout_amount.toString(), currency: 'USD' },
          receiver: payout.payment_details?.paypal_email || payout.affiliate_email,
          note: `Affiliate earnings for ${payout.payout_month}`
        }]
      })
    });

    const result = await payoutResponse.json();
    if (result.batch_header?.payout_batch_id) {
      return { success: true, transaction_id: result.batch_header.payout_batch_id };
    }
    return { success: false, error: result.message || 'PayPal error' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}