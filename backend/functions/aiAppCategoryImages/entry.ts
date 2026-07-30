import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { APP_TAXONOMY, allAppSubcategories } from "../../sdk/app-taxonomy.ts";
import { generateProductImageUrl } from "../../sdk/image-gen.ts";
import { snapBool } from "../../sdk/settings.ts";
import { db } from "../../sdk/db.ts";

// aiAppCategoryImages (INTERNAL/ADMIN, scheduled) — spins up ORIGINAL App Store category tiles on the
// serverless GPU, ONCE per category, exactly like the retail aiCategoryImages. Top categories first,
// then subsections. Stored in CatalogCategory { name, level, image_url, kind:"app" } so they don't
// collide with the retail category tiles. Skips any that already have an image; bounded per run.
//   Body (optional): { include_subcategories?: boolean, per_run_cap?: number }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({}));
    const includeSubs = b?.include_subcategories != null ? !!b.include_subcategories : snapBool("APP_SUBCATEGORY_IMAGES", false);
    const cap = Math.max(1, Math.floor(Number(b?.per_run_cap) || 30));

    const existing = await db.filter("CatalogCategory", { kind: "app" }).catch(() => []) as Record<string, unknown>[];
    const haveImage = new Set((existing || []).filter((r) => r?.image_url).map((r) => String(r.name).toLowerCase()));

    const work: { name: string; level: number }[] = [];
    for (const t of APP_TAXONOMY) if (!haveImage.has(t.name.toLowerCase())) work.push({ name: t.name, level: 1 });
    if (includeSubs) for (const s of allAppSubcategories()) if (!haveImage.has(s.toLowerCase())) work.push({ name: s, level: 2 });

    let made = 0;
    for (const item of work) {
      if (made >= cap) break;
      // A clean app-tile prompt (icon/hero art), not a product photo.
      const url = await generateProductImageUrl(`${item.name} mobile apps`, `App Store category tile for ${item.name} apps, modern app icon collage style`, `App Store / ${item.name}`).catch(() => null);
      if (!url) continue;
      const [row] = await db.filter("CatalogCategory", { name: item.name, kind: "app" }).catch(() => []) as Record<string, unknown>[];
      if (row?.id) await db.update("CatalogCategory", String(row.id), { image_url: url }).catch(() => null);
      else await db.create("CatalogCategory", { name: item.name, level: item.level, kind: "app", image_url: url, created_at: new Date().toISOString() }).catch(() => null);
      made++;
    }

    return Response.json({ success: true, kind: "app", images_created_this_run: made, remaining: Math.max(0, work.length - made) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
