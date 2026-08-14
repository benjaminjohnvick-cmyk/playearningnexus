import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { computeProductStats, productStatsEnabled, productStatsSourceEntity } from "../../sdk/product-stats.ts";

// productStatsCompile (INTERNAL/ADMIN, meant to be SCHEDULED) — aggregates real Orders per product and stores
// one ProductStat row per product (units, buyers, median/avg revenue, AOV), marking it published once the
// sample passes the threshold. This is the "collect statistical data on anything sold" engine: it powers
// showing how a product works (below threshold) vs. real results (at/above threshold), and feeds the AI.
//   Body: { dry_run?: boolean }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    if (!productStatsEnabled()) return Response.json({ skipped: true, reason: "PRODUCT_STATS_ENABLED off" });

    const nowISO = new Date().toISOString();
    const entity = productStatsSourceEntity();
    const rows = await base44.asServiceRole.entities[entity].filter({}, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    const stats = computeProductStats(rows || [], nowISO);

    let written = 0;
    if (!dryRun) {
      for (const s of stats) {
        // One row per product: update in place if it exists, else create.
        const existing = await db.filter("ProductStat", { item: s.item }, "-created_date", 1).catch(() => []);
        const doc = { ...s, computed_at: nowISO };
        if (existing && existing[0]) await db.update("ProductStat", String((existing[0] as Record<string, unknown>).id), doc);
        else await db.create("ProductStat", doc, me?.id ?? undefined);
        written++;
      }
    }

    return Response.json({
      ok: true, dry_run: dryRun,
      products_analyzed: stats.length,
      published: stats.filter((s) => s.published).length,
      gathering: stats.filter((s) => !s.published).length,
      written,
      top: stats.slice(0, 20),
      note: "Products at/above the sample threshold are published with a basis; the rest keep 'gathering data' (show how it works).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
