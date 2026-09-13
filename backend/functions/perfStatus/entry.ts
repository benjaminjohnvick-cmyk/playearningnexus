import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { perfReport, perfAutoOptimizeEnabled, perfPrefetchLevel, prefetchStrategyForLevel } from "../../sdk/perf-optimizer.ts";

// perfStatus (admin/internal) — READ: current load speed vs the ~80ms perception budget (p75 of real visitor
// samples per vital), the auto-optimizer state, and the in-app-navigation trend. Powers the Speed card on the
// Data-Driven Coverage dashboard. Read-only.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const report = await perfReport();
    const trendRows = await db.filter("OptimizationSignal", { metric: "route_nav_p75_ms" }, "-created_date", 60).catch(() => []);
    const trend = (trendRows || []).map((r: any) => ({ at: String(r.collected_at ?? r.created_date ?? ""), value: Number(r.value) || 0 })).reverse();
    const level = perfPrefetchLevel();
    return Response.json({
      ok: true,
      ...report,
      auto_optimize_enabled: perfAutoOptimizeEnabled(),
      prefetch_level: level,
      prefetch_strategy: prefetchStrategyForLevel(level),
      trend,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
