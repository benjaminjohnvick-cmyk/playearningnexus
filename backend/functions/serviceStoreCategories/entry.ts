import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { SERVICE_TAXONOMY } from "../../sdk/service-taxonomy.ts";
import { db } from "../../sdk/db.ts";

// serviceStoreCategories (authenticated) — the Services section's sections + subsections, each with its
// serverless-GPU category tile (when generated). Mirrors appStoreCategories so the Services store gets
// the SAME category-tile browse experience as the App Store and the retail catalog. The UI renders
// these to show all service categories with images and their subsections, and to drive the filter.
//   Body: {}  →  { categories: [{ name, image_url, subs: [{ name, image_url }] }] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("CatalogCategory", { kind: "service" }, undefined, 5000).catch(() => []) as Record<string, unknown>[];
    const imageByName = new Map<string, string>();
    for (const r of (rows || [])) if (r?.image_url) imageByName.set(String(r.name).toLowerCase(), String(r.image_url));

    const categories = SERVICE_TAXONOMY.map((t) => ({
      name: t.name,
      image_url: imageByName.get(t.name.toLowerCase()) || null,
      subs: t.subs.map((s) => ({ name: s, image_url: imageByName.get(s.toLowerCase()) || null })),
    }));

    return Response.json({ categories, count: categories.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
