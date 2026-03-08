import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Venmo is owned by PayPal — users can receive PayPal payouts to their Venmo-linked email/phone
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

    const { payoutId, venmoUsername, amount, currency = 'USD' } = await req.json();
    if (!payoutId || !venmoUsername || !amount) {
      return Response.json({ error: 'Missing required fields: payoutId, venmoUsername, amount' }, { status: 400 });
    }
    if (amount < 10) return Response.json({ error: 'Minimum payout is $10' }, { status: 400 });

    // Venmo usernames can be sent via PayPal Payouts using the PHONE or EMAIL receiver type.
    // If the user provided an email, use EMAIL type; otherwise use PHONE for phone numbers.
    // For @username format, we queue as manual since Venmo doesn't have direct username API.
    const isEmail = venmoUsername.includes('@') && venmoUsername.includes('.');
    const isPhone = /^\+?[\d\s\-()]{7,15}$/.test(venmoUsername);

    let recipientType, recipientValue;
    if (isEmail) {
      recipientType = 'EMAIL';
      recipientValue = venmoUsername;
    } else if (isPhone) {
      recipientType = 'PHONE';
      recipientValue = venmoUsername.replace(/\D/g, '');
    } else {
      // Venmo @username — queue for manual processing by admin
      await base44.asServiceRole.entities.Payout.update(payoutId, {
        status: 'pending',
        description: `Venmo manual payout to ${venmoUsername} — awaiting admin processing`,
      });

      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'purchase_complete',
        title: '💙 Venmo Payout Queued',
        message: `Your $${amount.toFixed(2)} Venmo payout to ${venmoUsername} is queued for processing within 24 hours.`,
        status: 'unread',
        delivery_method: ['in_app'],
      });

      return Response.json({ success: true, status: 'queued', message: 'Venmo payout queued for manual processing within 24 hours.' });
    }

    const accessToken = await getPayPalAccessToken();
    const batchId = `GG_VENMO_${payoutId}_${Date.now()}`;

    const payload = {
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: 'Your GamerGain Venmo Payout Has Arrived!',
        email_message: `Your earnings of $${amount.toFixed(2)} have been sent to your Venmo account.`,
      },
      items: [
        {
          recipient_type: recipientType,
          amount: { value: amount.toFixed(2), currency },
          receiver: recipientValue,
          note: 'GamerGain earnings payout via Venmo',
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
      const errMsg = ppData.message || ppData.name || `PayPal/Venmo error ${ppRes.status}`;
      await base44.asServiceRole.entities.Payout.update(payoutId, {
        status: 'failed',
        error_message: errMsg,
      });
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
      title: '💙 Venmo Payout Processing!',
      message: `Your $${amount.toFixed(2)} Venmo payout is on its way. Batch ID: ${batchPayoutId}`,
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({ success: true, batch_id: batchPayoutId, status: 'processing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});