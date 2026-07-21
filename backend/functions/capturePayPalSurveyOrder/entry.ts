import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET_KEY = Deno.env.get('PAYPAL_SECRET_KEY');
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';

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

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, sampleSize, surveyTitle } = await req.json();
    if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok || captureData.status !== 'COMPLETED') {
      return Response.json({ success: false, error: captureData.message || 'Capture failed' }, { status: 400 });
    }

    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const amountPaid = parseFloat(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

    // Record the transaction
    await base44.asServiceRole.entities.PPCTransaction.create({
      user_id: user.id,
      transaction_type: 'survey_charge',
      amount: amountPaid,
      net_amount: amountPaid,
      description: `Survey creation charge (PayPal): ${sampleSize} responses for "${surveyTitle}"`,
      status: 'completed',
    });

    return Response.json({
      success: true,
      capture_id: captureId,
      amount_paid: amountPaid,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});