import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Venmo is owned by PayPal. PayPal Payouts API sends directly to Venmo-linked email or phone.
// This is fully automated — money arrives in the recipient's Venmo balance instantly.

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.paypal.com'; // Live endpoint

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
    const { payoutId, venmoContact, amount, currency = 'USD', payout_type } = body;

    const isBusinessRole = BUSINESS_ROLES.includes(user.role);
    const isEligiblePayoutType = ['referral_commission', 'contest_win'].includes(payout_type);
    if (!isBusinessRole && !isEligiblePayoutType) {
      return Response.json({ error: 'Forbidden: You are not eligible for Venmo payouts.' }, { status: 403 });
    }

    if (!payoutId || !venmoContact || !amount) {
      return Response.json({ error: 'Missing required fields: payoutId, venmoContact, amount' }, { status: 400 });
    }
    if (amount < 10) return Response.json({ error: 'Minimum payout is $10' }, { status: 400 });

    // Determine recipient type: EMAIL or PHONE
    const isEmail = venmoContact.includes('@') && venmoContact.includes('.');
    const recipientType = isEmail ? 'EMAIL' : 'PHONE';
    const recipientValue = isEmail ? venmoContact : venmoContact.replace(/\D/g, '');

    if (!isEmail && recipientValue.length < 7) {
      return Response.json({ error: 'Please provide a valid email or phone number linked to your Venmo account.' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();
    const batchId = `GG_VENMO_${payoutId}_${Date.now()}`;

    const payload = {
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: 'Your GamerGain Payout Has Arrived!',
        email_message: `Your GamerGain earnings of $${amount.toFixed(2)} have been sent to your Venmo account.`,
      },
      items: [
        {
          recipient_type: recipientType,
          amount: { value: amount.toFixed(2), currency },
          receiver: recipientValue,
          note: 'GamerGain earnings payout',
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
      const errMsg = ppData.message || ppData.name || `Venmo payout error ${ppRes.status}`;
      await base44.asServiceRole.entities.Payout.update(payoutId, { status: 'failed', error_message: errMsg });
      return Response.json({ error: errMsg }, { status: 400 });
    }

    const batchPayoutId = ppData.batch_header?.payout_batch_id;

    await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'processing',
      paypal_batch_id: batchPayoutId,
      external_transaction_id: batchPayoutId,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: 'purchase_complete',
      title: '💙 Venmo Payout Sent!',
      message: `Your $${amount.toFixed(2)} Venmo payout is on its way to ${venmoContact}. Batch ID: ${batchPayoutId}`,
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({ success: true, batch_id: batchPayoutId, status: 'processing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});