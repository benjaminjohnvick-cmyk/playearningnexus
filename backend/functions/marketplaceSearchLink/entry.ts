import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { buildSearchLink } from "../../sdk/catalog.ts";
import { snapString } from "../../sdk/settings.ts";

// marketplaceSearchLink (authenticated) — "now go search for the real thing." Returns a shopper-facing
// search URL for a listing's product. Uses an AUTHORIZED affiliate search link when configured
// (monetized + disclosed); otherwise a neutral shopping search. The platform listing stays original
// and priced in closed-loop points; this is just a convenience funnel to buy the real item elsewhere.
//   Body: { listing_id?, query?, country? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    let query = (b.query || "").toString();
    let country = (b.country || "").toString();

    if (b.listing_id) {
      const [listing] = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: b.listing_id });
      if (listing) {
        query = query || listing.title || "";
        country = country || listing.country || "";
      }
    }
    if (!country) country = snapString("CATALOG_COUNTRIES", "US").split(",")[0].trim() || "US";
    if (!query) return Response.json({ error: "query or listing_id required" }, { status: 400 });

    const link = buildSearchLink(country, query);
    return Response.json({
      success: true,
      ...link,
      disclosure: link.affiliate ? "Affiliate link — we may earn a commission if you buy." : undefined,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
