import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { APP_TAXONOMY } from "../../sdk/app-taxonomy.ts";
import { db } from "../../sdk/db.ts";

// appStoreCategories (authenticated) — the App Store's sections + subsections, each with its
// serverless-GPU category tile (when generated). This is what the App Store UI renders to show all the
// mobile-app categories with images and their subsections, and to drive the category filter.
//   Body: {}  →  { categories: [{ name, image_url, subs: [{ name, image_url }] }] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.filter("CatalogCategory", { kind: "app" }, undefined, 5000).catch(() => []) as Record<string, unknown>[];
    const imageByName = new Map<string, string>();
    for (const r of (rows || [])) if (r?.image_url) imageByName.set(String(r.name).toLowerCase(), String(r.image_url));

    const categories = APP_TAXONOMY.map((t) => ({
      name: t.name,
      image_url: imageByName.get(t.name.toLowerCase()) || null,
      subs: t.subs.map((s) => ({ name: s, image_url: imageByName.get(s.toLowerCase()) || null })),
    }));

    return Response.json({ categories, count: categories.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
