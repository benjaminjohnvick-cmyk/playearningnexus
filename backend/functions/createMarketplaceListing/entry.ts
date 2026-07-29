import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { blockedOrderReason } from "../../sdk/catalog-policy.ts";

// createMarketplaceListing (authenticated seller) — Facebook-Marketplace-style listing. Seller sets a
// points price and/or a USD price; buyers pay with points or by card (card adds the platform markup).
// The seller is responsible for shipping. Body:
//   { title, description, price_points?, price_usd?, category?, condition?, images?, location?, shipping_info? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    // Validate prices numerically (a non-numeric string must not slip through as a null price).
    const pp = b.price_points != null && b.price_points !== "" ? Number(b.price_points) : null;
    const pu = b.price_usd != null && b.price_usd !== "" ? Number(b.price_usd) : null;
    const ppOk = pp != null && Number.isFinite(pp) && pp > 0;
    const puOk = pu != null && Number.isFinite(pu) && pu > 0;
    if (!b.title || (!ppOk && !puOk)) {
      return Response.json({ error: "title and a valid positive price (price_points or price_usd) are required" }, { status: 400 });
    }

    // Prohibited / regulated items: block weapons, drugs, and other restricted goods (marketplace liability).
    const blocked = blockedOrderReason({ name: `${b.title} ${b.description || ""}`, category: b.category });
    if (blocked) return Response.json({ error: `Listing not allowed: ${blocked}` }, { status: 422 });

    const listing = await base44.asServiceRole.entities.MarketplaceListing.create({
      seller_id: user.id,
      seller_name: user.full_name || user.email,
      title: String(b.title).slice(0, 200),
      description: (b.description || "").toString().slice(0, 5000),
      price_points: ppOk ? Math.round(pp) : null,
      price_usd: puOk ? Math.round(pu * 100) / 100 : null,
      category: b.category || "general",
      condition: b.condition || "used",
      images: Array.isArray(b.images) ? b.images.slice(0, 10) : [],
      location: b.location || null,
      shipping_info: b.shipping_info || null,
      // Physical Items: how the buyer receives it. "ship" (default) or "pickup" (local pickup) — a
      // pickup listing carries a pickup_location shown to the buyer.
      fulfillment_mode: b.fulfillment_mode === "pickup" ? "pickup" : "ship",
      pickup_location: b.fulfillment_mode === "pickup" ? String(b.pickup_location || b.location || "").slice(0, 200) : null,
      status: "active",
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, listing_id: (listing as any).id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
