import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";
import { curatorRewardPointsPct } from "../../sdk/revenue.ts";
import { deriveSellerUsername, isSeller, recordCuratedAdd } from "../../sdk/seller-activation.ts";

// addCatalogToStorefront — a user curates a PLATFORM-CATALOG product they found via search into their own
// storefront. It becomes a listing under their username on the seller marketplace, but the platform sources
// and fulfills it (AI order function) and keeps the wholesale spread; the buyer pays no markup. When it
// sells, the curator earns CURATOR_REWARD_POINTS_PCT (10%) back in non-cashable points (locked until they
// activate member use). This is NOT the "keep 100%" deal — that's only the user's OWN uploaded products.
//
// Body: { catalog_listing_id }  → { success, listing_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { catalog_listing_id } = await req.json().catch(() => ({}));
    if (!catalog_listing_id) return Response.json({ error: "catalog_listing_id required" }, { status: 400 });

    const src = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: catalog_listing_id }).then((r: any) => r[0]);
    if (!src) return Response.json({ error: "Product not found" }, { status: 404 });
    // Only platform-catalog products can be curated (the platform sources + fulfills them). A user's own
    // upload or an affiliate link isn't eligible.
    const isCatalog = src.source === "platform_catalog" || src.seller_id === PLATFORM_SELLER_ID;
    if (!isCatalog) return Response.json({ error: "Only catalog products can be added to your storefront." }, { status: 422 });

    // Low-friction: provision seller identity on first add (member activation for spendable points is a
    // separate one-click — curator points simply stay locked until then).
    const username = (user as Record<string, unknown>).seller_username as string || deriveSellerUsername(user as Record<string, unknown>);
    if (!isSeller(user as Record<string, unknown>)) {
      await db.update("User", user.id, { is_seller: true, seller_username: username, seller_since: (user as Record<string, unknown>).seller_since ?? new Date().toISOString() }).catch(() => null);
    }

    // Idempotent: don't create a second curated copy of the same catalog item for the same seller.
    const dupe = await db.filter("MarketplaceListing", { seller_id: user.id, source: "curated", origin_listing_id: src.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (dupe && dupe[0]) {
      return Response.json({ success: true, already: true, listing_id: dupe[0].id, message: "This product is already in your storefront." });
    }

    const listing = await base44.asServiceRole.entities.MarketplaceListing.create({
      seller_id: user.id,
      seller_name: username,
      source: "curated",                       // curated resale of a catalog product
      origin_listing_id: src.id,
      curator_user_id: user.id,
      title: String(src.title || "Product").slice(0, 200),
      description: (src.description || "").toString().slice(0, 5000),
      price_points: Number(src.price_points) || null,   // same price — buyer pays no markup
      price_usd: Number(src.price_usd) || null,
      category: src.category || "general",
      condition: src.condition || "new",
      images: Array.isArray(src.images) ? src.images.slice(0, 10) : [],
      image_url: src.image_url || null,
      product_type: src.product_type || "physical",
      fulfillment_mode: src.fulfillment_mode || "ship",
      // Platform sources + fulfills; carry the wholesale cost so the sourcing spread still books at sale.
      fulfilled_by: "platform_ai",
      wholesale_cost_usd: Number(src.wholesale_cost_usd) || null,
      curator_reward_pct: curatorRewardPointsPct(),
      fulfillment_disclosure: "Fulfilled by GamerGain. Curated by a member.",
      country: src.country || null,
      status: "active",
      created_at: new Date().toISOString(),
    });

    // Level counters (recognition only — no points; the 10% pays on a real sale).
    const level = await recordCuratedAdd(user.id).catch(() => null);

    return Response.json({
      success: true,
      listing_id: (listing as any).id,
      seller_username: username,
      curator_reward_pct: curatorRewardPointsPct(),
      level,
      message: "Added to your storefront. You'll earn 10% back in points if it sells (fulfilled by GamerGain).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
