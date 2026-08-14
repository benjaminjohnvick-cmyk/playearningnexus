import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { productStatView, type ProductStat } from "../../sdk/product-stats.ts";

// productStats (read-only) — the compiled statistics for a product (or the published set). Returns real
// "results" once a product has enough orders, otherwise a "gathering data / how it works" view. Safe to show
// to buyers and to feed the AI concierge. Auth required (any signed-in user); only published stats are shown
// as results.
//   Body: { item?: string, published_only?: boolean, limit?: number }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.item) {
      const rows = await db.filter("ProductStat", { item: String(body.item) }, "-created_date", 1).catch(() => []) as ProductStat[];
      const stat = rows && rows[0] ? rows[0] : null;
      return Response.json({ view: productStatView(stat, String(body.item)) });
    }

    const limit = Math.max(1, Math.min(500, Math.round(Number(body.limit) || 100)));
    const rows = await db.filter("ProductStat", {}, "-created_date", 2000).catch(() => []) as ProductStat[];
    // Dedupe to the latest row per item.
    const latest = new Map<string, ProductStat>();
    for (const r of rows || []) { if (!latest.has(r.item)) latest.set(r.item, r); }
    let list = [...latest.values()];
    if (body.published_only === true) list = list.filter((s) => s.published);
    list.sort((a, b) => b.sample_size - a.sample_size);
    return Response.json({ products: list.slice(0, limit), count: list.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
