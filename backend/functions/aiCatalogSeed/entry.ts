import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber, snapString } from "../../sdk/settings.ts";
import { ensureTemplateListings, cloneTemplatesToCountry, providersForCountry } from "../../sdk/catalog.ts";

// aiCatalogSeed (INTERNAL/ADMIN, scheduled) — populates the marketplace catalog, per country, with
// Amazon-breadth categories, using the TEMPLATE-ONCE + CLONE-PER-COUNTRY model:
//   1. Build a country-agnostic TEMPLATE set of ORIGINAL products spread across every category. Product
//      images are generated exactly ONCE here (the "original set").
//   2. For every launched country (CATALOG_COUNTRIES, or a `countries`/`country` override), CLONE the
//      templates into that country — reusing the SAME base image (a country flag is overlaid at display
//      time) and localizing price so points equal one cent in the LOCAL currency.
// Images are never regenerated per country, so all images spin up one time. Nothing scrapes any
// retailer. Body (optional): { country?, countries?[], category?, per_run_image_cap? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));

    // Countries: explicit override → CATALOG_COUNTRIES → "US".
    let countries: string[] = [];
    if (Array.isArray(body?.countries)) countries = body.countries;
    else if (typeof body?.country === "string") countries = [body.country];
    else countries = snapString("CATALOG_COUNTRIES", "US").split(",");
    countries = [...new Set(countries.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean))];
    if (!countries.length) countries = ["US"];

    const categories = body?.category
      ? [String(body.category)]
      : snapString("CATALOG_CATEGORIES", "General").split(",").map((s) => s.trim()).filter(Boolean);

    const target = Math.max(0, Math.floor(await getNumber("CATALOG_LISTINGS_PER_COUNTRY", 320)));
    const perCategoryTemplates = categories.length ? Math.max(1, Math.ceil(target / categories.length)) : target;

    // 1. Ensure the TEMPLATE set exists (images generated once, capped per run so a single run is bounded).
    const imageCap = Math.max(0, Math.floor(Number(body?.per_run_image_cap) || 40));
    let templatesCreated = 0;
    for (const category of categories) {
      if (imageCap && templatesCreated >= imageCap) break; // remaining categories fill on the next run
      const made = await ensureTemplateListings(perCategoryTemplates, category).catch(() => 0);
      templatesCreated += made;
    }

    // 2. Clone templates into each country (no image generation — reuses base images + flag + local price).
    const seeded: any[] = [];
    for (const country of countries) {
      const cloned = await cloneTemplatesToCountry(country).catch(() => 0);
      seeded.push({ country, cloned, affiliate_providers_live: providersForCountry(country).map((p) => p.label) });
    }

    return Response.json({ success: true, templates_created_this_run: templatesCreated, template_categories: categories.length, seeded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
