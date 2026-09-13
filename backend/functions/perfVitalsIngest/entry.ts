import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { perfMonitoringEnabled, PERF_VITALS } from "../../sdk/perf-optimizer.ts";

// perfVitalsIngest — the tiny, PUBLIC beacon target the client's perf-vitals.js posts real load-speed samples to
// (LCP, INP, in-app navigation time, TTFB, …). Anonymous by design: a cold first paint happens before any login,
// and we want speed data from every visitor. No PII — only the metric name, the value in ms, and the route NAME.
// Each sample becomes an OptimizationSignal row (metric = perf_vital_<name>), so the existing AI optimizer reads
// their p75 as the objective it minimizes, and the numbers trend on the dashboard. Cheap + best-effort; it never
// throws back at the page and is a no-op when monitoring is off.
const ACTOR = "system@getgoodsgratis.local";
const VALID = new Set<string>(PERF_VITALS as readonly string[]);

export default __handler(async (req) => {
  try {
    if (!perfMonitoringEnabled()) return Response.json({ ok: true, ignored: "monitoring_off" });
    const body = await req.json().catch(() => ({}));
    const samples = Array.isArray(body?.samples) ? body.samples.slice(0, 50) : [];
    const at = new Date().toISOString();
    let stored = 0;
    for (const s of samples) {
      const metric = String(s?.metric ?? "");
      const value = Number(s?.value);
      if (!VALID.has(metric) || !Number.isFinite(value) || value < 0 || value > 600000) continue; // sane bounds
      const route = s?.route ? String(s.route).slice(0, 60) : "";
      await db.create("OptimizationSignal", {
        metric: `perf_vital_${metric}`, value: Math.round(value), window_days: 0, collected_at: at,
        route, load_kind: s?.load_kind ? String(s.load_kind).slice(0, 12) : "",
      }, ACTOR).catch(() => null);
      stored++;
    }
    return Response.json({ ok: true, stored });
  } catch {
    // Telemetry must never surface an error to the page.
    return Response.json({ ok: true, stored: 0 });
  }
});
