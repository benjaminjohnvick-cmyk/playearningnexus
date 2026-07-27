import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { buildSearchLinks, SORT_OPTIONS } from "../../sdk/catalog.ts";
import { snapString } from "../../sdk/settings.ts";

// marketplaceSearchLink (authenticated) — "now go find the real thing." Returns sorted search links
// across multiple engines (Amazon, Google Shopping, eBay) so a click pulls up real listings from
// across the internet. Amazon carries the affiliate tag when authorized (disclosed). Supports sort
// (best match / price asc / price desc / rating / newest) and an optional price range. The platform
// listing stays original and priced in closed-loop points; this is a discovery/affiliate funnel.
//   Body: { listing_id?, query?, country?, sort?, min_price?, max_price?, category? }
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

    const { affiliate, engines } = buildSearchLinks(country, query, {
      sort: b.sort,
      minPrice: b.min_price != null ? Number(b.min_price) : undefined,
      maxPrice: b.max_price != null ? Number(b.max_price) : undefined,
      category: b.category,
    });

    return Response.json({
      success: true,
      query,
      country,
      engines,
      sort_options: SORT_OPTIONS,
      affiliate,
      disclosure: affiliate ? "Amazon links are affiliate links — we may earn a commission if you buy." : undefined,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
