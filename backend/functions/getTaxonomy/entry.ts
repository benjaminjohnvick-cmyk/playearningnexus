import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { TAXONOMY, taxonomyCounts, subcategoriesOf } from "../../sdk/taxonomy.ts";
import { db } from "../../sdk/db.ts";

// getTaxonomy (authenticated) — returns the hierarchical product taxonomy for the category browser:
// top categories → subcategories, plus any AI-generated category tile images and browse-node counts.
//   Body (optional): { category?: string }  — if given, returns that category's subcategories + browse nodes.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));

    // Category tile images generated on the serverless GPU (aiCategoryImages), if present.
    const imgRows = await db.filter("CatalogCategory", {}).catch(() => []) as any[];
    const imageByName: Record<string, string> = {};
    for (const r of (imgRows || [])) if (r?.name && r?.image_url) imageByName[String(r.name).toLowerCase()] = r.image_url;

    if (b?.category) {
      const subs = subcategoriesOf(b.category);
      const nodes = await db.filter("CatalogBrowseNode", { parent_category: b.category }, undefined, 5000).catch(() => []) as any[];
      // Group AI browse nodes (the deep "subcategory" level) under their subcategory.
      const bySub: Record<string, string[]> = {};
      for (const n of (nodes || [])) { const k = n.parent_sub || ""; (bySub[k] = bySub[k] || []).push(n.name); }
      return Response.json({
        success: true,
        category: b.category,
        image_url: imageByName[String(b.category).toLowerCase()] || null,
        browse_node_count: (nodes || []).length,
        subcategories: subs.map((s) => ({ name: s, image_url: imageByName[s.toLowerCase()] || null, nodes: bySub[s] || [] })),
      });
    }

    const counts = taxonomyCounts();
    return Response.json({
      success: true,
      counts: { ...counts, browse_node_target: counts.subcategories * 24 }, // ≈ 21,700 (exceeds 20,000)
      categories: TAXONOMY.map((t) => ({ name: t.name, image_url: imageByName[t.name.toLowerCase()] || null, subcategory_count: t.subs.length })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
