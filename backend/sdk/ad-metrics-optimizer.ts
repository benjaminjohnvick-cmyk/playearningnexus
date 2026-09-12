// ad-metrics-optimizer.ts — closes the MEASURE → LEARN → IMPROVE loop for the advertising metric set, using
// the SAME primitives the rest of the platform's self-improvement loop already consumes:
//   • OptimizationSignal  — one weighted row per metric per sweep = the TRACKING history the optimizer /
//                           self-learning grounding reads back (trend over time).
//   • AgentLearningMemory — the durable per-agent lesson (learningInsights trend + learningDistill roll-up).
// No new tables (the platform convention). Every automatic action is routed through the autonomy kernel via
// gateAndRun("ad_optimization", …): reversible delivery re-prioritization INSIDE fixed budget/rate caps may
// auto-apply on trust; anything that would raise spend stays on the gated (human-disposes) path. Money and
// billing remain on their permanent gates untouched.
//
// HONESTY: acts only on SUBSTANTIATED metrics; below threshold it records the reading but proposes nothing.
// "AI proposes, measured data justifies, a human disposes" when the gate isn't open.
import { db } from "./db.ts";
import { gateAndRun } from "./autonomy-gate.ts";
import { adMetricsAiOptimizationEnabled } from "./ad-metrics.ts";
import { ppcBenchmarks, type AdvertiserMetrics } from "./advertiser-metrics.ts";
import { type OptimizeObjective } from "./ad-audience.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Agent name under which ad-metric learning shows up in the oversight feed + learningInsights dashboard. */
export const AD_METRICS_AGENT = "ad_metrics_optimizer";

/** The metrics we track over time (each becomes an OptimizationSignal row per sweep). */
const TRACKED = ["roas", "ctr_pct", "conv_rate_pct", "cpa_usd", "cpp_usd", "ecpm_usd", "fill_rate_pct", "arpdau_usd"] as const;

/** Record a metric snapshot as learning signals — this is the TRACKING step (history the optimizer reads).
 *  Best-effort; never throws into the sweep. `scope` is "advertiser:<id>" or "publisher". */
export async function recordAdMetricSnapshot(
  scope: string,
  metrics: Record<string, unknown>,
  windowDays: number,
): Promise<void> {
  const at = new Date().toISOString();
  for (const key of TRACKED) {
    const value = Number(metrics[key]);
    if (!isFinite(value)) continue;
    await db.create("OptimizationSignal", {
      kind: "ad_metric", scope, metric: key, value, window_days: windowDays,
      collected_at: at, created_at: at,
    }).catch(() => null);
  }
  await db.create("AgentLearningMemory", {
    agent_name: AD_METRICS_AGENT, type: "ad_metric_snapshot", target: scope,
    success: Number(metrics.roas) >= (ppcBenchmarks().roas || 0), provisional: true,
    improvement_notes: `Snapshot ${scope}: ROAS ${r2(Number(metrics.roas) || 0)}×, CTR ${r2(Number(metrics.ctr_pct) || 0)}%, eCPM $${r2(Number(metrics.ecpm_usd) || 0)}.`,
    scope, window_days: windowDays, recorded_at: at, created_at: at,
  }).catch(() => null);
}

export interface MetricTrend { metric: string; latest: number; prior: number; direction: "up" | "down" | "flat"; samples: number; }
/** Read tracked signals back into per-metric trends (latest vs prior half of the lookback). */
export async function adMetricLearning(lookbackDays = 30, scope?: string): Promise<{ trends: MetricTrend[]; sampled: number }> {
  try {
    const since = new Date(Date.now() - Math.max(1, lookbackDays) * 86400000).toISOString();
    const rows = (await db.filter("OptimizationSignal", { kind: "ad_metric" }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const recent = rows.filter((s) => String(s.created_at ?? s.created_date ?? "") >= since && (!scope || String(s.scope) === scope));
    const mid = new Date(Date.now() - Math.max(1, lookbackDays) / 2 * 86400000).toISOString();
    const trends: MetricTrend[] = [];
    for (const metric of TRACKED) {
      const forMetric = recent.filter((s) => String(s.metric) === metric);
      if (!forMetric.length) continue;
      const older = forMetric.filter((s) => String(s.created_at ?? s.created_date ?? "") < mid).map((s) => Number(s.value) || 0);
      const newer = forMetric.filter((s) => String(s.created_at ?? s.created_date ?? "") >= mid).map((s) => Number(s.value) || 0);
      const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      const latest = r2(avg(newer.length ? newer : older));
      const prior = r2(avg(older.length ? older : newer));
      const dir = latest > prior * 1.02 ? "up" : latest < prior * 0.98 ? "down" : "flat";
      trends.push({ metric, latest, prior, direction: dir, samples: forMetric.length });
    }
    return { trends, sampled: recent.length };
  } catch {
    return { trends: [], sampled: 0 };
  }
}

export type AdAction = "boost" | "steady" | "vary" | "cut";
export interface AdOptimizationAction {
  subject_id: string;          // AdListing id (or advertiser id)
  action: AdAction;
  metric_basis: string;        // which measured metric drove it
  rationale: string;
  reversible: boolean;         // delivery re-prioritization is reversible; never a spend increase
  audience_focus: "all" | "new" | "existing"; // which audience the advertiser is optimizing delivery toward
}

/** Map an advertiser's optimize_for objective to the audience the optimizer should favor in delivery. */
function focusFor(objective?: OptimizeObjective): "all" | "new" | "existing" {
  if (objective === "new_users") return "new";
  if (objective === "existing_users") return "existing";
  return "all";
}

/** Pure: turn one advertiser's MEASURED metrics into a delivery-priority action, benchmarked, honoring
 *  substantiation. Never proposes a spend increase — only how to prioritize delivery within fixed caps.
 *  boost = healthy ROAS, favor delivery; cut = paying but under-converting, pull back; vary = engagement
 *  ok but conversion weak, rotate creative; steady = on benchmark. */
export function decideAdAction(m: AdvertiserMetrics, subjectId: string, objective?: OptimizeObjective): AdOptimizationAction | null {
  if (!m.substantiated) return null;
  const b = ppcBenchmarks();
  const focus = focusFor(objective);
  const audienceNote = focus === "all" ? "" : ` Favor ${focus} users (advertiser objective).`;
  const base = { subject_id: subjectId, reversible: true, audience_focus: focus };
  if (m.roas >= b.roas * 1.1) {
    return { ...base, action: "boost", metric_basis: `ROAS ${m.roas}× ≥ benchmark ${b.roas}×`, rationale: "Delivering above the ROAS benchmark — prioritize its delivery within existing caps." + audienceNote };
  }
  if (m.roas > 0 && m.roas < b.roas * 0.6 && m.spend_usd > 0) {
    return { ...base, action: "cut", metric_basis: `ROAS ${m.roas}× < 60% of benchmark ${b.roas}×`, rationale: "Spending with weak return — de-prioritize delivery (no spend change) and flag for review." + audienceNote };
  }
  if (m.ctr_pct >= b.ctr_pct && m.conv_rate_pct < b.conv_rate_pct * 0.7) {
    return { ...base, action: "vary", metric_basis: `CTR ${m.ctr_pct}% ok but CVR ${m.conv_rate_pct}% weak`, rationale: "Clicks are landing but not converting — rotate creative / offer." + audienceNote };
  }
  return { ...base, action: "steady", metric_basis: `ROAS ${m.roas}× near benchmark`, rationale: "On benchmark — hold delivery steady." + audienceNote };
}

/** Apply one action through the autonomy kernel. Reversible delivery re-prioritization within caps may
 *  auto-apply on trust; otherwise gateAndRun records a pending review for a human to dispose. Writes a
 *  reversible `optimizer_hint` on the AdListing (never touches budget/bid/spend). Returns the gate result. */
export async function applyAdAction(action: AdOptimizationAction) {
  if (!adMetricsAiOptimizationEnabled()) return { executed: false, pending: false, reason: "ai optimization disabled" };
  const at = new Date().toISOString();
  return await gateAndRun("ad_optimization", {
    subjectId: action.subject_id,
    summary: `Ad-metric optimizer: ${action.action} — ${action.metric_basis}`,
    caps: { spend_change: 0, reversible: true },
    reversible: true,
    undoRef: `optimizer_hint:${action.subject_id}`,
    proposal: action,
  }, async () => {
    // Reversible, non-spend delivery hint the delivery engine reads as a priority nudge.
    try {
      await db.update("AdListing", action.subject_id, {
        optimizer_hint: action.action,
        optimizer_hint_reason: action.rationale,
        optimizer_audience_focus: action.audience_focus,
        optimizer_hint_at: at,
      });
    } catch { /* listing may not exist for advertiser-level actions — the decision is still recorded */ }
    // Outcome signal so the loop can measure whether the nudge helped next sweep.
    await db.create("OptimizationSignal", {
      kind: "ad_metric_action", scope: `advertiser:${action.subject_id}`, metric: "delivery_priority",
      value: action.action === "boost" ? 1 : action.action === "cut" ? -1 : 0,
      action: action.action, note: action.rationale, created_at: at,
    }).catch(() => null);
    return { hinted: action.action };
  });
}
