import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";

// affirmConfirm (authenticated buyer) — after the buyer completes Affirm.js, the client sends back the
// checkout_token. We AUTHORIZE then CAPTURE the charge with Affirm (merchant is paid upfront; Affirm
// owns the default risk), then atomically claim the listing and open a fulfilled order. Real goods only.
//   Body: { listing_id, checkout_token, shipping_address? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isEnabled("affirm_bnpl"))) return Response.json({ error: "Financing isn't available." }, { status: 403 });

    const pub = Deno.env.get("AFFIRM_PUBLIC_API_KEY");
    const priv = Deno.env.get("AFFIRM_PRIVATE_API_KEY");
    if (!pub || !priv) return Response.json({ error: "Financing isn't configured." }, { status: 403 });

    const { listing_id, checkout_token, shipping_address } = await req.json().catch(() => ({}));
    if (!listing_id || !checkout_token) return Response.json({ error: "listing_id and checkout_token required" }, { status: 400 });

    const listing = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: listing_id }).then((r: any) => r[0]);
    if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return Response.json({ error: `Listing is ${listing.status}` }, { status: 409 });
    if (listing.source === "affiliate" || (Number(listing.price_usd) || 0) <= 0) {
      return Response.json({ error: "This item can't be financed." }, { status: 400 });
    }

    const apiBase = Deno.env.get("AFFIRM_API_BASE") || (Deno.env.get("AFFIRM_ENV") === "live" ? "https://api.affirm.com" : "https://sandbox.affirm.com");
    const auth = "Basic " + btoa(`${pub}:${priv}`);

    // 1. Authorize the charge from the checkout token.
    const authRes = await fetch(`${apiBase}/api/v2/charges`, {
      method: "POST", headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ checkout_token, order_id: `mkt_${listing.id}_${user.id}` }),
    });
    const authJson = await authRes.json().catch(() => ({}));
    if (!authRes.ok || !authJson?.id) {
      return Response.json({ error: "Affirm authorization failed", detail: authJson?.message || authRes.status }, { status: 402 });
    }
    const chargeId = authJson.id;

    // 2. Claim the listing atomically BEFORE capturing (so we don't capture a lost race). If we lose,
    //    void the authorization so the buyer isn't on the hook.
    const claimed = await db.updateIf("MarketplaceListing", listing.id,
      { status: "sold", sold_to: user.id, sold_at: new Date().toISOString() },
      { field: "status", equals: "active" });
    if (!claimed) {
      await fetch(`${apiBase}/api/v2/charges/${chargeId}/void`, { method: "POST", headers: { authorization: auth } }).catch(() => null);
      return Response.json({ error: "Sorry — this item was just sold. Your financing was cancelled." }, { status: 409 });
    }

    // 3. Capture — merchant is paid upfront by Affirm.
    const capRes = await fetch(`${apiBase}/api/v2/charges/${chargeId}/capture`, {
      method: "POST", headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ order_id: `mkt_${listing.id}_${user.id}` }),
    });
    if (!capRes.ok) {
      // Release the listing; leave the auth to expire.
      await db.updateIf("MarketplaceListing", listing.id, { status: "active", sold_to: null }, { field: "status", equals: "sold" }).catch(() => null);
      return Response.json({ error: "Affirm capture failed — item released, you were not charged." }, { status: 402 });
    }
    const capJson = await capRes.json().catch(() => ({}));
    const amountUsd = (Number(capJson?.amount ?? authJson?.amount) || 0) / 100;

    const isPlatform = (listing.source === "platform_catalog") || listing.seller_id === PLATFORM_SELLER_ID;
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id, seller_id: listing.seller_id, listing_id: listing.id, item_name: listing.title,
      amount: amountUsd, payment_method: "affirm", payment_captured: true, affirm_charge_id: chargeId,
      fulfillment_type: isPlatform ? "platform_ai" : "seller_ship", source: listing.source || "user",
      shipping_address: shipping_address || null, status: "awaiting_shipment", created_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "marketplace_purchase",
      title: "🛍️ Purchase confirmed (Affirm)", message: `You financed "${listing.title}" with Affirm. It'll ship soon.`, is_read: false,
    }).catch(() => null);
    if (!isPlatform) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: listing.seller_id, type: "marketplace_sale",
        title: "💰 Your item sold!", message: `"${listing.title}" sold (financed). Please ship it to release your funds.`, is_read: false,
      }).catch(() => null);
    }
    const fulfillFn = isPlatform ? "aiOrderFulfillment" : "autoOrderFulfillmentAndFundsRelease";
    base44.asServiceRole.functions.invoke(fulfillFn, { order_id: (order as any).id }).catch(() => null);

    return Response.json({ success: true, order_id: (order as any).id, charge_id: chargeId, amount_usd: amountUsd });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
