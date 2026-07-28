import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { getNumber, snapString } from "../../sdk/settings.ts";
import { generateSeedListings, providersForCountry, PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";

// aiCatalogSeed (INTERNAL/ADMIN, scheduled) — populates the marketplace catalog FIRST, per country,
// with Amazon-breadth category coverage. For every launched country (CATALOG_COUNTRIES, or a
// `countries`/`country` override) it walks every catalog category and tops each up toward its share
// of CATALOG_LISTINGS_PER_COUNTRY with ORIGINAL AI listings + original images. It ONLY creates NEW
// listings — existing ones (and their images) are never regenerated, so product images spin up exactly
// once per item. It also reports which AUTHORIZED affiliate providers are live per country. Nothing
// here scrapes or copies any retailer.
//   Body (optional): { country?, countries?[], count?, category?, per_run_cap? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Countries: explicit override → CATALOG_COUNTRIES → "US".
    let countries: string[] = [];
    if (Array.isArray(body?.countries)) countries = body.countries;
    else if (typeof body?.country === "string") countries = [body.country];
    else countries = snapString("CATALOG_COUNTRIES", "US").split(",");
    countries = [...new Set(countries.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean))];
    if (!countries.length) countries = ["US"];

    // Categories: a single override, else the full Amazon-breadth list.
    const categories = body?.category
      ? [String(body.category)]
      : snapString("CATALOG_CATEGORIES", "General").split(",").map((s) => s.trim()).filter(Boolean);

    const target = Math.max(0, Math.floor(await getNumber("CATALOG_LISTINGS_PER_COUNTRY", 320)));
    const perCategoryTarget = categories.length ? Math.max(1, Math.ceil(target / categories.length)) : target;
    // Safety cap on how many NEW listings a single run creates (images are generated for these).
    const perRunCap = Math.max(0, Math.floor(Number(body?.per_run_cap) || 60));

    const results: any[] = [];
    let createdThisRun = 0;

    for (const country of countries) {
      // Pull this country's active platform listings once, then bucket by category (avoids N queries).
      const existing = await base44.asServiceRole.entities.MarketplaceListing.filter({
        seller_id: PLATFORM_SELLER_ID, country, status: "active",
      }).catch(() => []);
      const byCat: Record<string, number> = {};
      for (const l of (Array.isArray(existing) ? existing : [])) {
        const c = (l.category || "General").toString();
        byCat[c] = (byCat[c] || 0) + 1;
      }

      let createdForCountry = 0;
      for (const category of categories) {
        if (perRunCap && createdThisRun >= perRunCap) break; // run budget exhausted; next run continues
        const have = byCat[category] || 0;
        let deficit = body?.count ? Math.max(0, Math.floor(Number(body.count))) : Math.max(0, perCategoryTarget - have);
        if (perRunCap) deficit = Math.min(deficit, perRunCap - createdThisRun);
        if (deficit <= 0) continue;
        // Only creates NEW listings — existing items and their images are left untouched (images once).
        const createdIds = await generateSeedListings(country, deficit, category).catch(() => []);
        createdForCountry += createdIds.length;
        createdThisRun += createdIds.length;
      }

      const providers = providersForCountry(country).map((p) => p.label);
      results.push({
        country,
        existing: Array.isArray(existing) ? existing.length : 0,
        target,
        categories: categories.length,
        created: createdForCountry,
        affiliate_providers_live: providers,
      });
    }

    return Response.json({ success: true, created_this_run: createdThisRun, seeded: results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
