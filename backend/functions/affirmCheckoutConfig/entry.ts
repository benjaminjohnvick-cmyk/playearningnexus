import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { getNumber } from "../../sdk/settings.ts";

// affirmCheckoutConfig (authenticated buyer) — build the Affirm checkout object for a REAL, shippable
// marketplace item so the client can open Affirm.js. Affirm underwrites the buyer and carries the
// default risk; the merchant is paid upfront. This is for REAL GOODS ONLY — never for points, store
// credit, or "play" credit (Affirm's terms + law prohibit financing those).
//   Body: { listing_id, shipping: { name, address1, city, state, zipcode, country }, email? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("affirm_bnpl"))) {
      return Response.json({ blocked: true, reason: "affirm_disabled", message: "Financing isn't available right now." }, { status: 403 });
    }
    const pub = Deno.env.get("AFFIRM_PUBLIC_API_KEY");
    if (!pub) return Response.json({ blocked: true, reason: "affirm_unconfigured", message: "Financing isn't configured." }, { status: 403 });

    const { listing_id, shipping, email } = await req.json().catch(() => ({}));
    const listing = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: listing_id }).then((r: any) => r[0]);
    if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return Response.json({ error: `Listing is ${listing.status}` }, { status: 409 });

    // REAL-GOODS GUARD: Affirm is only for tangible shippable products with a real USD price. Block
    // affiliate listings (retailer fulfills), and anything that is points/credit/digital "play" value.
    const base = Number(listing.price_usd) || 0;
    const cat = String(listing.category || "").toLowerCase();
    const isDigitalOrCredit = ["points", "store credit", "credit", "gift card", "virtual currency", "coins"].some((k) => cat.includes(k)) || listing.item_type === "points" || listing.digital === true;
    if (listing.source === "affiliate") return Response.json({ error: "This item is fulfilled by the retailer; finance it there." }, { status: 400 });
    if (base <= 0 || isDigitalOrCredit) return Response.json({ error: "Financing is only available for real, shippable products." }, { status: 400 });
    if (!shipping || !shipping.address1 || !shipping.zipcode) return Response.json({ error: "A shipping address is required to finance this item." }, { status: 400 });

    const markup = await getNumber("STORE_MARKUP", 0.10);
    const totalUsd = Math.round(base * (1 + markup) * 100) / 100;
    const cents = Math.round(totalUsd * 100);
    const siteBase = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("VITE_NEXUS_API_URL") || "";

    // Affirm checkout object (amounts in cents). The client passes this to Affirm.checkout(...).
    const checkout = {
      merchant: {
        public_api_key: pub,
        user_confirmation_url: `${siteBase}/Marketplace?affirm=confirm`,
        user_cancel_url: `${siteBase}/Marketplace?affirm=cancel`,
        user_confirmation_url_action: "POST",
        name: "GamerGain",
      },
      shipping: {
        name: { full: shipping.name || user.full_name || "Customer" },
        address: {
          line1: shipping.address1, line2: shipping.address2 || "",
          city: shipping.city, state: shipping.state, zipcode: shipping.zipcode,
          country: shipping.country || "USA",
        },
      },
      billing: { email: email || user.email },
      items: [{
        display_name: String(listing.title || "Item").slice(0, 120),
        sku: String(listing.id),
        unit_price: cents,
        qty: 1,
        item_image_url: listing.image_url || (Array.isArray(listing.images) ? listing.images[0] : "") || "",
        item_url: `${siteBase}/Marketplace`,
      }],
      order_id: `mkt_${listing.id}_${user.id}`,
      shipping_amount: 0,
      tax_amount: 0,
      total: cents,
      metadata: { listing_id: listing.id, buyer_id: user.id, source: listing.source || "user" },
    };

    return Response.json({ success: true, checkout, total_usd: totalUsd, markup_applied: Math.round(base * markup * 100) / 100 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
