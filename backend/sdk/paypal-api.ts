// paypal-api.ts — the LIVE PayPal REST client. Reads credentials from the environment (never from the DB),
// so nothing can charge until the owner sets their keys. Everything runs under the owner's PayPal account.
//
//   Env: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV=sandbox|live (or PAYPAL_API_BASE override),
//        PUBLIC_SITE_URL (return/cancel redirects), PAYPAL_BUSINESS_EMAIL (payout receiver, optional).
//
// Capabilities: OAuth token, create + capture a Checkout order (customer card/PayPal payment), and Payouts
// (paying suppliers/sellers, or funding the points-covered portion of an order). This module is the wiring;
// the app calls it at checkout/fulfillment once the keys are present.

const clientId = () => Deno.env.get("PAYPAL_CLIENT_ID") || "";
const secret = () => Deno.env.get("PAYPAL_SECRET") || "";
export function paypalConfigured(): boolean { return !!clientId() && !!secret(); }

function apiBase(): string {
  return Deno.env.get("PAYPAL_API_BASE") || (Deno.env.get("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
}
const siteUrl = () => (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/+$/, "");

/** OAuth2 client-credentials access token. Throws if not configured or the call fails. */
export async function getAccessToken(): Promise<string> {
  if (!paypalConfigured()) throw new Error("PayPal is not configured (set PAYPAL_CLIENT_ID / PAYPAL_SECRET).");
  const basic = btoa(`${clientId()}:${secret()}`);
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = await res.json();
  return String(j.access_token);
}

/** Create a Checkout order (intent CAPTURE) for `amountUsd`. Returns the PayPal order id + the approve link
 *  the client redirects the buyer to. `ref` is your internal order id (stored as custom_id + invoice_id). */
export async function createOrder(input: { amountUsd: number; ref?: string; description?: string }): Promise<{ id: string; approve_url: string | null; status: string }> {
  const token = await getAccessToken();
  const value = (Math.round((Number(input.amountUsd) || 0) * 100) / 100).toFixed(2);
  const body = {
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: "USD", value },
      custom_id: input.ref || undefined,
      invoice_id: input.ref ? `ord_${input.ref}_${value}` : undefined,
      description: (input.description || "GamerGain order").slice(0, 120),
    }],
    application_context: {
      brand_name: "GamerGain",
      user_action: "PAY_NOW",
      return_url: siteUrl() ? `${siteUrl()}/paypal/return` : undefined,
      cancel_url: siteUrl() ? `${siteUrl()}/paypal/cancel` : undefined,
    },
  };
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal create order failed (${res.status})`);
  const j = await res.json();
  const approve = (j.links || []).find((l: Record<string, unknown>) => l.rel === "approve");
  return { id: String(j.id), approve_url: approve ? String(approve.href) : null, status: String(j.status || "CREATED") };
}

/** Capture an approved order. Returns {captured, capture_id, amount}. */
export async function captureOrder(orderId: string): Promise<{ captured: boolean; capture_id: string | null; amount_usd: number; status: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const j = await res.json().catch(() => ({}));
  const status = String(j.status || "");
  const cap = j?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  return {
    captured: status === "COMPLETED",
    capture_id: cap?.id ? String(cap.id) : null,
    amount_usd: cap?.amount?.value ? Number(cap.amount.value) : 0,
    status,
  };
}

/** Send a Payout (e.g. pay a supplier/seller, or fund the points-covered portion). Runs under the owner's
 *  PayPal balance. Returns the payout batch id. */
export async function createPayout(input: { email: string; amountUsd: number; note?: string; ref?: string }): Promise<{ batch_id: string | null; status: string }> {
  const token = await getAccessToken();
  const value = (Math.round((Number(input.amountUsd) || 0) * 100) / 100).toFixed(2);
  const body = {
    sender_batch_header: { sender_batch_id: `payout_${input.ref || value}_${Date.now()}`, email_subject: "You have a payment from GamerGain" },
    items: [{ recipient_type: "EMAIL", amount: { value, currency: "USD" }, receiver: input.email, note: (input.note || "").slice(0, 120), sender_item_id: input.ref || undefined }],
  };
  const res = await fetch(`${apiBase()}/v1/payments/payouts`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal payout failed (${res.status})`);
  const j = await res.json();
  return { batch_id: j?.batch_header?.payout_batch_id ? String(j.batch_header.payout_batch_id) : null, status: String(j?.batch_header?.batch_status || "PENDING") };
}
