import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { blockedOrderReason } from "../../sdk/catalog-policy.ts";

// relistItem (authenticated member) — turn something you own into a marketplace listing WITHOUT
// exposing any personal information. The listing shows an anonymized seller ("GamerGain Member"), is
// buyable with points or card, and its order is handled by the AI order-fulfillment lifecycle.
//   Body: { order_id?, title?, description?, price_points?, price_usd?, category?, condition?, images? }
//   Provide order_id to relist a prior purchase (title is derived from it), or title+price directly.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));

    // If relisting a prior purchase, verify the caller actually owns that order.
    let baseTitle = b.title;
    let baseImages = Array.isArray(b.images) ? b.images : [];
    if (b.order_id) {
      const [order] = await base44.asServiceRole.entities.Order.filter({ id: b.order_id });
      if (!order || order.user_id !== user.id) {
        return Response.json({ error: "Order not found or not yours." }, { status: 404 });
      }
      baseTitle = baseTitle || order.item_name;
      if (!baseImages.length && order.image_url) baseImages = [order.image_url];
    }

    const pp = b.price_points != null && b.price_points !== "" ? Number(b.price_points) : null;
    const pu = b.price_usd != null && b.price_usd !== "" ? Number(b.price_usd) : null;
    const ppOk = pp != null && Number.isFinite(pp) && pp > 0;
    const puOk = pu != null && Number.isFinite(pu) && pu > 0;
    if (!baseTitle || (!ppOk && !puOk)) {
      return Response.json({ error: "A title and a valid positive price (price_points or price_usd) are required" }, { status: 400 });
    }

    const blocked = blockedOrderReason({ name: `${baseTitle} ${b.description || ""}`, category: b.category });
    if (blocked) return Response.json({ error: `Listing not allowed: ${blocked}` }, { status: 422 });

    const listing = await base44.asServiceRole.entities.MarketplaceListing.create({
      seller_id: user.id,                 // internal ownership only — never displayed
      seller_name: "GamerGain Member",    // anonymized: no name, email, or location exposed
      title: String(baseTitle).slice(0, 200),
      description: (b.description || "").toString().slice(0, 5000),
      price_points: ppOk ? Math.round(pp) : null,
      price_usd: puOk ? Math.round(pu * 100) / 100 : null,
      category: b.category || "general",
      condition: b.condition || "used",
      images: baseImages.slice(0, 10),
      image_url: baseImages[0] || null,
      source: "user",                     // member listing → AI-managed fulfillment lifecycle + points
      relisted: true,
      status: "active",
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, listing_id: (listing as any).id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
