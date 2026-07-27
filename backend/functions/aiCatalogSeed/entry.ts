import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { getNumber, snapString } from "../../sdk/settings.ts";
import { generateSeedListings, providersForCountry, PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";

// aiCatalogSeed (INTERNAL/ADMIN, scheduled) — populates the marketplace catalog FIRST, per country.
//
// For every launched country (CATALOG_COUNTRIES, or a `countries`/`country` override in the body) it
// counts active platform-catalog listings and tops them up toward CATALOG_LISTINGS_PER_COUNTRY with
// ORIGINAL AI-generated products + original images (serverless-GPU pipeline). It also reports which
// AUTHORIZED affiliate providers are live for each country (those with your API credentials set) so
// real branded goods can be layered in legally. Nothing here scrapes or copies any retailer.
//   Body (optional): { country?: string, countries?: string[], count?: number, category?: string }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Resolve the country list: explicit override → CATALOG_COUNTRIES setting → "US".
    let countries: string[] = [];
    if (Array.isArray(body?.countries)) countries = body.countries;
    else if (typeof body?.country === "string") countries = [body.country];
    else countries = snapString("CATALOG_COUNTRIES", "US").split(",");
    countries = [...new Set(countries.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean))];
    if (!countries.length) countries = ["US"];

    const target = Math.max(0, Math.floor(await getNumber("CATALOG_LISTINGS_PER_COUNTRY", 24)));
    const results: any[] = [];

    for (const country of countries) {
      // Count existing active platform listings for this country so we only top up the deficit.
      const existing = await base44.asServiceRole.entities.MarketplaceListing.filter({
        seller_id: PLATFORM_SELLER_ID, country, status: "active",
      }).catch(() => []);
      const have = Array.isArray(existing) ? existing.length : 0;
      const deficit = body?.count ? Math.max(0, Math.floor(Number(body.count))) : Math.max(0, target - have);

      let createdIds: string[] = [];
      if (deficit > 0) {
        createdIds = await generateSeedListings(country, deficit, body?.category).catch(() => []);
      }
      const providers = providersForCountry(country).map((p) => p.label);
      results.push({ country, had: have, target, created: createdIds.length, affiliate_providers_live: providers });
    }

    return Response.json({ success: true, seeded: results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
