import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com'; // switch to api-m.paypal.com for live

async function getPayPalAccessToken() {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
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

    const { sampleSize, surveyTitle, returnUrl, cancelUrl } = await req.json();

    const minSample = Math.max(sampleSize || 100, 100);
    const totalAmount = (minSample * 4).toFixed(2);

    const accessToken = await getPayPalAccessToken();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: totalAmount },
        description: `Survey: "${surveyTitle}" — ${minSample} responses @ $4 each`,
        custom_id: user.id,
      }],
      application_context: {
        return_url: returnUrl || 'https://gamergain.com/Surveys?paypal=success',
        cancel_url: cancelUrl || 'https://gamergain.com/Surveys?paypal=cancel',
        brand_name: 'GamerGain',
        user_action: 'PAY_NOW',
      },
    };

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return Response.json({ error: orderData.message || 'Failed to create PayPal order' }, { status: 400 });
    }

    const approvalLink = orderData.links?.find(l => l.rel === 'approve')?.href;

    return Response.json({
      success: true,
      order_id: orderData.id,
      approval_url: approvalLink,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});