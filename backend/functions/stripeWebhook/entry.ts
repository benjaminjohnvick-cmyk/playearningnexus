import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });

// stripeWebhook — PUBLIC endpoint (no user auth; Stripe authenticates via signature). Completes the SCA /
// 3-D Secure flow: an advertiser subscription is created 'default_incomplete' and the seat is left PENDING
// until payment actually clears. Stripe calls this when that happens, and we flip pending → active (or, on a
// failure/cancellation, keep it pending / deactivate). Verifies the signature against STRIPE_WEBHOOK_SECRET.
//
// Configure in Stripe: add an endpoint → https://<backend>/functions/stripeWebhook, subscribe to
// invoice.paid, payment_intent.succeeded, invoice.payment_failed, customer.subscription.deleted; put the
// signing secret in STRIPE_WEBHOOK_SECRET.
async function activateByCustomer(customerId: string, active: boolean) {
  if (!customerId) return 0;
  const users = await db.filter("User", { stripe_customer_id: customerId }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
  let n = 0;
  for (const u of users || []) {
    await db.update("User", String(u.id), active
      ? { ppc_grid_active: true, ppc_grid_pending: false, ppc_grid_activated_at: new Date().toISOString() }
      : { ppc_grid_active: false }).catch(() => null);
    n++;
  }
  return n;
}

export default __handler(async (req) => {
  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
    const sig = req.headers.get("stripe-signature") || "";
    const raw = await req.text();

    if (!secret) return Response.json({ error: "Webhook not configured (STRIPE_WEBHOOK_SECRET unset)." }, { status: 503 });
    if (!sig) return Response.json({ error: "Missing signature." }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
    } catch (e) {
      return Response.json({ error: `Signature verification failed: ${(e as Error).message}` }, { status: 400 });
    }

    let handled = "";
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        await activateByCustomer(String(inv.customer || ""), true);
        handled = "activated";
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await activateByCustomer(String(pi.customer || ""), true);
        handled = "activated";
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        // Leave the seat PENDING (not active); notify best-effort.
        const users = await db.filter("User", { stripe_customer_id: String(inv.customer || "") }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
        for (const u of users || []) {
          await db.update("User", String(u.id), { ppc_grid_pending: true, ppc_grid_active: false }).catch(() => null);
          await db.create("Notification", { user_id: String(u.id), type: "ppc_payment_failed", title: "Payment needs attention", message: "Your advertising payment didn't go through (it may need card authentication). Please retry to activate your seat.", is_read: false }).catch(() => null);
        }
        handled = "payment_failed";
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await activateByCustomer(String(sub.customer || ""), false);
        handled = "deactivated";
        break;
      }
      default:
        handled = "ignored";
    }

    return Response.json({ received: true, type: event.type, handled });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
