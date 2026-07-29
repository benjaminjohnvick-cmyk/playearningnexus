import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { snapString } from "../../sdk/settings.ts";
import { buildSearchLinks, PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";
import { rankOffers, type Offer } from "../../sdk/pricing.ts";
import { eligibleForDiscount, loyaltyDiscountPct } from "../../sdk/loyalty.ts";
import { db } from "../../sdk/db.ts";

// productBestPrice (authenticated) — the shopper picked an exact product; find the CHEAPEST all-in
// version and apply the member benefit.
//
// It scores every offer we can actually price by LANDED COST (item + tax + shipping − existing
// discounts) and returns the lowest. HONEST SCOPE: it prices our first-party catalog listings for that
// product plus any external offers passed in from a connected shopping/price feed (`external_offers`);
// it does not crawl the whole internet. Where no live feed is connected, it still returns the cheapest
// first-party option and the shopping-discovery links for the shopper to compare externally.
//
// THE 10% MEMBER BENEFIT is applied correctly by source: a REAL 10% off a first-party winner
// (platform-absorbed), or 10% back as loyalty credit on an external winner (we can't change another
// retailer's checkout — so it's an honest credit-back, not a fake lower price).
//
// Body: { listing_id?, query?, country?, external_offers?: Offer[] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    let query = String(b.query || "");
    let country = String(b.country || "");

    // Resolve the exact product from a listing id if provided.
    let picked: Record<string, unknown> | null = null;
    if (b.listing_id) {
      picked = (await base44.asServiceRole.entities.MarketplaceListing.filter({ id: b.listing_id }).catch(() => []))[0] || null;
      if (picked) { query = query || String(picked.title || ""); country = country || String(picked.country || ""); }
    }
    if (!country) country = (snapString("CATALOG_COUNTRIES", "US").split(",")[0] || "US").trim();
    if (!query) return Response.json({ error: "query or listing_id required" }, { status: 400 });

    // 1) First-party offers: our catalog listings that match this product (real, priceable, discountable).
    const fpListings = (await base44.asServiceRole.entities.MarketplaceListing.filter(
      { seller_id: PLATFORM_SELLER_ID, status: "active" }, "-created_date", 500,
    ).catch(() => [])) as Record<string, unknown>[];
    const q = query.toLowerCase();
    const firstParty: Offer[] = fpListings
      .filter((l) => picked ? String(l.id) === String(picked!.id) || String(l.title || "").toLowerCase().includes(q) : String(l.title || "").toLowerCase().includes(q))
      .slice(0, 25)
      .map((l) => ({
        source: "first_party", seller: "GamerGain Store", title: String(l.title || ""), listing_id: String(l.id),
        item_price_usd: Number(l.price_usd) || 0, tax_usd: Number(l.tax_usd) || 0, shipping_usd: Number(l.shipping_usd) || 0,
        existing_discount_usd: Number(l.sale_discount_usd) || 0, currency: "USD",
      }));

    // 2) External offers from a connected price feed, if the caller supplied any (honest: we score what
    //    we can see; we do not fabricate prices).
    const external: Offer[] = Array.isArray(b.external_offers)
      ? (b.external_offers as Record<string, unknown>[]).slice(0, 50).map((o) => ({
          source: "external", seller: String(o.seller || o.retailer || "Retailer"), title: String(o.title || query),
          url: o.url ? String(o.url) : undefined, item_price_usd: Number(o.item_price_usd ?? o.price) || 0,
          tax_usd: Number(o.tax_usd) || 0, shipping_usd: Number(o.shipping_usd) || 0,
          existing_discount_usd: Number(o.existing_discount_usd ?? o.discount) || 0, currency: String(o.currency || "USD"),
        }))
      : [];

    // Member benefit rate: only if the shopper is an eligible loyalty member with the program on.
    let memberPct = 0;
    if (await isEnabled("loyalty_program")) {
      const mem = ((await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[])[0] || null;
      if (eligibleForDiscount(mem)) memberPct = loyaltyDiscountPct();
    }

    const ranked = rankOffers([...firstParty, ...external], memberPct);
    const cheapest = ranked[0] || null;

    // External-discovery links (shopping engines) so the shopper can compare / bring back external offers.
    const discovery = buildSearchLinks(country, query, { sort: "price_asc" });

    return Response.json({
      query, country,
      cheapest,                        // the single best all-in option (with the correct member benefit)
      offers: ranked.slice(0, 15),     // the ranked list we could price
      priced_first_party: firstParty.length,
      priced_external: external.length,
      member_benefit_pct: memberPct,
      discovery_links: discovery,      // shopping links to find/bring back external offers to score
      note: external.length === 0
        ? "Ranked by all-in landed cost across your first-party options. Connect a shopping/price feed (or pass external_offers) to also score live external retailers; use the discovery links to compare now."
        : "Ranked by all-in landed cost (item + tax + shipping − existing discounts). Your 10% comes back as loyalty points-back after purchase (the sticker price is unchanged), on whichever option wins.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
