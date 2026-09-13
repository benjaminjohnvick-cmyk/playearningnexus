// perf-optimizer.ts — load-speed telemetry math + the perception budget, shared by the perf functions and wired
// into the EXISTING AI optimizer (optimizer.ts registers PERF knobs) and the autonomy kernel (a "load_time"
// domain), so load-time optimization runs on the same convention as every other AI process — which means it also
// feeds the CUSTOM model's training data and shows up as a "function" in the function-by-function switch gate.
//
// THE NUMBER (researched): the human brain perceives a response as INSTANTANEOUS at ~100 ms (Nielsen / Card —
// the classic 0.1 s limit). The owner's directive: aim 20% BELOW that (=80 ms) and go as low as possible toward
// the ~1-frame visual floor (~13-16 ms). So the budget default is 80 ms and the optimizer's goal is "min" (drive
// it down without bound). Cold first paint over a network has a physical floor (DNS+TLS+RTT) that no code
// removes, so LCP's cold budget is separate (1000 ms "good"); the 80 ms wall is for what IS controllable —
// in-app navigation, interaction latency, and warm/repeat loads.
import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";

export const PERF_INSTANT_PERCEPTION_MS = 100;  // researched human "feels instant" threshold
export const PERF_VITALS = ["ttfb", "fcp", "lcp", "inp", "cls_x1000", "route", "page_load"] as const;
export type PerfVital = typeof PERF_VITALS[number];

// Getters (mirror the custom-model.ts getter convention).
export const perfMonitoringEnabled = () => snapBool("PERF_MONITORING_ENABLED", true);
export const perfAutoOptimizeEnabled = () => snapBool("PERF_AUTO_OPTIMIZE_ENABLED", true);
export const perfPrefetchEnabled = () => snapBool("PERF_PREFETCH_ENABLED", true);
export const perfPrefetchLevel = () => Math.max(0, Math.min(3, Math.round(snapNumber("PERF_PREFETCH_LEVEL", 2))));
export const perfQueryStaleMinutes = () => Math.max(1, Math.round(snapNumber("PERF_QUERY_STALE_MINUTES", 15)));
export const perfSampleRate = () => { const r = snapNumber("PERF_SAMPLE_RATE", 1); return r > 0 && r <= 1 ? r : 1; };
export const perfBudgetInstantMs = () => Math.max(1, snapNumber("PERF_BUDGET_INSTANT_MS", 80));   // 20% below 100ms
export const perfBudgetRouteMs = () => Math.max(1, snapNumber("PERF_BUDGET_ROUTE_MS", 80));
export const perfBudgetInpMs = () => Math.max(1, snapNumber("PERF_BUDGET_INP_MS", 80));
export const perfBudgetLcpMs = () => Math.max(1, snapNumber("PERF_BUDGET_LCP_MS", 1000));           // cold, network-bound

// PERF_PREFETCH_LEVEL (numeric, what the optimizer tunes) -> the client strategy string (what perfConfig serves).
export const prefetchStrategyForLevel = (lvl: number): string => (["off", "hover", "visible", "eager"][Math.max(0, Math.min(3, Math.round(lvl)))] || "visible");

const SIGNAL = (v: string) => `perf_vital_${v}`;

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return Math.round(s[idx]);
}

/** p75 (and count) of a vital over the last `limit` recorded samples. p75 is the standard "most users are at
 *  least this fast" number used by Web Vitals. */
export async function vitalP75(vital: PerfVital, limit = 1000): Promise<{ p75: number; p50: number; n: number }> {
  const rows = await db.filter("OptimizationSignal", { metric: SIGNAL(vital) }, "-created_date", limit).catch(() => []);
  const vals = (rows || []).map((r: any) => Number(r.value) || 0).filter((v) => v >= 0);
  return { p75: percentile(vals, 75), p50: percentile(vals, 50), n: vals.length };
}

export interface VitalStatus { vital: string; label: string; p75: number; p50: number; n: number; budget_ms: number; status: "instant" | "good" | "needs_work"; unit: string; }

const LABELS: Record<string, string> = {
  route: "In-app navigation", inp: "Interaction (tap→paint)", lcp: "Largest content paint",
  fcp: "First paint", ttfb: "Time to first byte", page_load: "Full page load", cls_x1000: "Layout stability",
};

/** Full budget report across the controllable vitals, classified against the perception budget. */
export async function perfReport(): Promise<{ vitals: VitalStatus[]; instant_budget_ms: number; perception_ms: number; overall: "instant" | "good" | "needs_work"; note: string }> {
  const instant = perfBudgetInstantMs();
  const budgets: Record<string, number> = { route: perfBudgetRouteMs(), inp: perfBudgetInpMs(), lcp: perfBudgetLcpMs(), fcp: Math.max(perfBudgetLcpMs() / 2, instant), ttfb: 200, page_load: perfBudgetLcpMs() };
  const vitals: VitalStatus[] = [];
  for (const v of ["route", "inp", "lcp", "fcp", "ttfb", "page_load"] as PerfVital[]) {
    const { p75, p50, n } = await vitalP75(v);
    const budget = budgets[v] ?? instant;
    const status: VitalStatus["status"] = n === 0 ? "good" : p75 <= budget * 0.8 ? "instant" : p75 <= budget ? "good" : "needs_work";
    vitals.push({ vital: v, label: LABELS[v] || v, p75, p50, n, budget_ms: Math.round(budget), status, unit: "ms" });
  }
  // The controllable "instant" verdict is driven by in-app navigation + interaction (what code controls).
  const controllable = vitals.filter((v) => v.vital === "route" || v.vital === "inp");
  const withData = controllable.filter((v) => v.n > 0);
  const overall: "instant" | "good" | "needs_work" = !withData.length ? "good"
    : withData.every((v) => v.status === "instant") ? "instant"
    : withData.some((v) => v.status === "needs_work") ? "needs_work" : "good";
  return {
    vitals, instant_budget_ms: Math.round(instant), perception_ms: PERF_INSTANT_PERCEPTION_MS, overall,
    note: overall === "instant"
      ? `Under the ${Math.round(instant)}ms budget — below the ~100ms the human brain can perceive, so navigation and taps feel instant.`
      : overall === "needs_work"
        ? `Above the ${Math.round(instant)}ms budget on a controllable metric — the AI optimizer will act to bring it back under.`
        : `Within budget; the optimizer keeps driving it lower toward the ~1-frame visual floor.`,
  };
}
