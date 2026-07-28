import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { TAXONOMY, allSubcategories } from "../../sdk/taxonomy.ts";
import { generateProductImageUrl } from "../../sdk/image-gen.ts";
import { snapBool } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";

// aiCategoryImages (INTERNAL/ADMIN, scheduled) — spins up ORIGINAL category tile images on the
// serverless GPU, ONCE per category. Generates for top-level categories first, then subcategories,
// storing each in CatalogCategory { name, level, image_url }. Skips any that already have an image, so
// images spin up exactly once. Bounded per run so cost stays smooth.
//   Body (optional): { include_subcategories?: boolean, per_run_cap?: number }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({}));
    // Budget posture: default to TOP-LEVEL tiles only (CATALOG_SUBCATEGORY_IMAGES off). A request body
    // can still force subcategory tiles on/off.
    const includeSubs = b?.include_subcategories != null ? !!b.include_subcategories : snapBool("CATALOG_SUBCATEGORY_IMAGES", false);
    const cap = Math.max(1, Math.floor(Number(b?.per_run_cap) || 30));

    const existing = await db.filter("CatalogCategory", {}).catch(() => []) as any[];
    const haveImage = new Set((existing || []).filter((r) => r?.image_url).map((r) => String(r.name).toLowerCase()));

    // Work list: top categories first, then subcategories.
    const work: { name: string; level: number }[] = [];
    for (const t of TAXONOMY) if (!haveImage.has(t.name.toLowerCase())) work.push({ name: t.name, level: 1 });
    if (includeSubs) for (const s of allSubcategories()) if (!haveImage.has(s.toLowerCase())) work.push({ name: s, level: 2 });

    let made = 0;
    for (const item of work) {
      if (made >= cap) break;
      const url = await generateProductImageUrl(item.name, `${item.name} product category`, item.name).catch(() => null);
      if (!url) continue;
      // Upsert the category image row.
      const [row] = await db.filter("CatalogCategory", { name: item.name }).catch(() => []) as any[];
      if (row?.id) await db.update("CatalogCategory", row.id, { image_url: url }).catch(() => null);
      else await db.create("CatalogCategory", { name: item.name, level: item.level, image_url: url, created_at: new Date().toISOString() }).catch(() => null);
      made++;
    }

    return Response.json({ success: true, images_created_this_run: made, remaining: Math.max(0, work.length - made) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
