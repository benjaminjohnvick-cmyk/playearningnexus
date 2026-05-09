import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com'; // switch to api-m.paypal.com for live

async function getPayPalAccessToken() {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Business eligibility check
    const BUSINESS_ROLES = ['admin', 'developer', 'survey_creator', 'ppc_advertiser'];
    const body = await req.json();
    const { payoutId, recipientEmail, amount, currency = 'USD', payout_type } = body;

    const isBusinessRole = BUSINESS_ROLES.includes(user.role);
    const isEligiblePayoutType = ['referral_commission', 'contest_win'].includes(payout_type);
    if (!isBusinessRole && !isEligiblePayoutType) {
      return Response.json({ error: 'Forbidden: You are not eligible for PayPal payouts.' }, { status: 403 });
    }

    if (!payoutId || !recipientEmail || !amount) {
      return Response.json({ error: 'Missing required fields: payoutId, recipientEmail, amount' }, { status: 400 });
    }
    if (amount < 10) return Response.json({ error: 'Minimum payout is $10' }, { status: 400 });

    const accessToken = await getPayPalAccessToken();

    const batchId = `GG_${payoutId}_${Date.now()}`;

    const payload = {
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: 'Your GamerGain Payout Has Arrived!',
        email_message: `Congratulations! Your earnings of $${amount.toFixed(2)} have been sent to your PayPal account.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: { value: amount.toFixed(2), currency },
          receiver: recipientEmail,
          note: 'GamerGain survey & referral earnings payout',
          sender_item_id: payoutId,
        },
      ],
    };

    const ppRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const ppData = await ppRes.json();

    if (!ppRes.ok) {
      const errMsg = ppData.message || ppData.name || `PayPal error ${ppRes.status}`;
      // Update payout record to failed
      await base44.asServiceRole.entities.Payout.update(payoutId, {
        status: 'failed',
        error_message: errMsg,
      });
      return Response.json({ error: errMsg }, { status: 400 });
    }

    const batchPayoutId = ppData.batch_header?.payout_batch_id;

    // Update payout record to processing with PayPal batch ID
    await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'processing',
      paypal_batch_id: batchPayoutId,
      external_transaction_id: batchPayoutId,
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'purchase_complete',
      title: '💸 Withdrawal Processing!',
      message: `Your $${amount.toFixed(2)} PayPal payout is on its way to ${recipientEmail}. Batch ID: ${batchPayoutId}`,
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({
      success: true,
      batch_id: batchPayoutId,
      status: 'processing',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});