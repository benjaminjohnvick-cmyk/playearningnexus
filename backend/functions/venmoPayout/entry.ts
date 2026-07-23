import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { isPartnerPayout } from "../../sdk/payout-policy.ts";

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

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "venmoPayout", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "venmoPayout — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { payoutId, venmoContact, amount, currency = 'USD', payout_type } = body;

    // --- Closed-loop policy: no cash out to regular users; business partners only ---
    if (!isPartnerPayout({ role: user?.role, payout_type })) {
      return Response.json({
        blocked: true, closed_loop: true, cash_sent: false,
        message: 'Closed-loop platform: user earnings remain as on-site credit (redeemable for perks) and are not paid out as cash. Only business-partner revenue shares are paid via Venmo.',
      }, { status: 200 });
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