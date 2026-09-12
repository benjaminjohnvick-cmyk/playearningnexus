// data-driven-coverage.ts — rolls the whole "is the site data-driven?" question into ONE number (two, really:
// BUILD coverage = is the loop wired, and LIVE coverage = is real data flowing through it yet). It reuses the
// existing spine — the autonomy kernel's domain map, the optimizer's OPTIMIZABLE registry, and the
// OptimizationSignal trend store + AgentPerformanceLog — so nothing new needs to be instrumented; it just reads
// what those already produce and reports coverage. Read-only. No new tables (snapshots are OptimizationSignal rows).
import { db } from "./db.ts";
import { DOMAINS } from "./autonomy-kernel.ts";
import { OPTIMIZABLE } from "./optimizer.ts";
import { snapBool } from "./settings.ts";

const ACTOR = "system@getgoodsgratis.local";

export const dataDrivenCoverageEnabled = () => snapBool("DATA_DRIVEN_COVERAGE_ENABLED", true);

// The signal families collectSignals() writes each cycle — one representative metric per family. "Live" coverage
// asks how many of these have a fresh row in the trend store (i.e., real data is flowing for that family).
const SIGNAL_FAMILIES: Array<{ family: string; metric: string }> = [
  { family: "Store / orders", metric: "store_orders" },
  { family: "Surveys", metric: "survey_responses" },
  { family: "Membership", metric: "membership_active" },
  { family: "Contests / tournaments", metric: "contest_revenue" },
  { family: "Developer supply", metric: "developer_supply" },
  { family: "Creator supply", metric: "creator_supply" },
  { family: "Engagement", metric: "engagement_rate" },
  { family: "Pricing feedback", metric: "pricing_feedback_count" },
  { family: "Referrals", metric: "referral_volume" },
  { family: "Payouts", metric: "payout_count" },
  { family: "Marketplace", metric: "marketplace_listings_active" },
  { family: "Games catalog", metric: "games_total" },
  { family: "Layaway", metric: "layaway_open" },
  { family: "Points boost", metric: "boost_events" },
  { family: "Founding data", metric: "founding_signal_volume" },
];

const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export interface CoverageReport {
  generated_at: string;
  headline_build_pct: number;   // is the data-driven loop fully wired? (structural — reads ~100% even pre-launch)
  live_pct: number;             // is real data actually flowing through it yet? (grows with traffic)
  components: Record<string, { label: string; pct: number; have: number; total: number; kind: "build" | "live"; note?: string }>;
  gaps: Array<{ area: string; detail: string }>;
  by_design_gates: number;      // money/identity/legal decisions that stay human-gated on purpose
  features_tracked: number;     // distinct AI features logging performance (breadth, informational)
}

export async function buildCoverageReport(freshDays = 3): Promise<CoverageReport> {
  const since = iso(freshDays);
  const gaps: Array<{ area: string; detail: string }> = [];

  // ---- BUILD coverage (structural: is the loop wired?) ----
  // 1) Autonomy kernel: every GATEABLE reversible domain routes its action through the kernel.
  const gateable = DOMAINS.filter((d) => d.gateable === true);
  const gateableWired = gateable.filter((d) => d.wired === true);
  const autonomyPct = pct(gateableWired.length, gateable.length);
  for (const d of gateable) if (d.wired !== true) gaps.push({ area: "Autonomy wiring", detail: `Domain "${d.label}" is gateable but its action is not yet routed through the kernel.` });
  const byDesignGates = DOMAINS.filter((d) => d.klass === "permanent_gate").length;

  // 2) Optimizer registry: every optimizable knob is registered with an objective (so it CAN be tuned by data).
  const optimizableTotal = OPTIMIZABLE.length;
  const optimizableRegistered = OPTIMIZABLE.filter((o) => !!o.objective).length;
  const optimizerBuildPct = pct(optimizableRegistered, optimizableTotal);

  // 3) Signal instrumentation: every family is defined for collection.
  const signalFamiliesDefined = SIGNAL_FAMILIES.length;

  const headlineBuildPct = Math.round(((autonomyPct + optimizerBuildPct + 100) / 3) * 10) / 10;

  // ---- LIVE coverage (runtime: is data actually flowing?) ----
  // a) Signal freshness: families with a fresh OptimizationSignal row.
  let freshFamilies = 0;
  for (const f of SIGNAL_FAMILIES) {
    const rows = await db.filter("OptimizationSignal", { metric: f.metric }, "-created_date", 1).catch(() => []);
    const fresh = (rows || []).some((r: any) => String(r.collected_at ?? r.created_date ?? "") >= since);
    if (fresh) freshFamilies++;
    else gaps.push({ area: "Signal flow", detail: `No fresh data for "${f.family}" in the last ${freshDays} days (expected once the feature has activity).` });
  }
  const signalLivePct = pct(freshFamilies, signalFamiliesDefined);

  // b) Optimizer live data: optimizable knobs whose objective metric has a fresh signal (so the AI can act on it).
  const freshMetrics = new Set<string>();
  // one bounded pull of recent signals, group by metric
  const recentSignals = await db.filter("OptimizationSignal", {}, "-created_date", 4000).catch(() => []);
  for (const r of recentSignals || []) {
    if (String((r as any).collected_at ?? (r as any).created_date ?? "") >= since) freshMetrics.add(String((r as any).metric ?? ""));
  }
  const optimizableLive = OPTIMIZABLE.filter((o) => freshMetrics.has(o.objective)).length;
  const optimizerLivePct = pct(optimizableLive, optimizableTotal);

  // c) Measured learning: are outcomes being recorded (the loop closing)?
  const outcomes = await db.filter("OptimizationOutcome", {}, "-created_date", 500).catch(() => []);
  const recentOutcomes = (outcomes || []).filter((o: any) => String(o.created_date ?? o.measured_at ?? "") >= iso(30)).length;

  // d) Feature-performance breadth (informational): distinct AI features logging performance.
  const perf = await db.filter("AgentPerformanceLog", {}, "-logged_at", 5000).catch(() => []);
  const featuresTracked = new Set((perf || []).map((p: any) => String(p.feature_name ?? "")).filter(Boolean)).size;

  const livePct = Math.round(((signalLivePct + optimizerLivePct) / 2) * 10) / 10;

  const components: CoverageReport["components"] = {
    autonomy_wiring: { label: "Autonomy loop wired (reversible domains routed through the kernel)", pct: autonomyPct, have: gateableWired.length, total: gateable.length, kind: "build" },
    optimizer_registered: { label: "Optimizable knobs registered with a data objective", pct: optimizerBuildPct, have: optimizableRegistered, total: optimizableTotal, kind: "build" },
    signal_families_defined: { label: "Signal families instrumented for collection", pct: 100, have: signalFamiliesDefined, total: signalFamiliesDefined, kind: "build" },
    signal_flow_live: { label: "Signal families with fresh data flowing", pct: signalLivePct, have: freshFamilies, total: signalFamiliesDefined, kind: "live", note: `fresh = a row in the last ${freshDays} days` },
    optimizer_live_data: { label: "Optimizable knobs with fresh objective data to act on", pct: optimizerLivePct, have: optimizableLive, total: optimizableTotal, kind: "live" },
  };

  return {
    generated_at: new Date().toISOString(),
    headline_build_pct: headlineBuildPct,
    live_pct: livePct,
    components,
    gaps,
    by_design_gates: byDesignGates,
    features_tracked: featuresTracked,
    // @ts-ignore extra informational field
    recent_measured_outcomes: recentOutcomes,
  } as CoverageReport;
}

// Persist the two headline numbers as OptimizationSignal rows so the dashboard can trend them over time.
export async function snapshotCoverage(report: CoverageReport): Promise<void> {
  const collectedAt = new Date().toISOString();
  await db.create("OptimizationSignal", { metric: "data_driven_build_pct", value: report.headline_build_pct, window_days: 0, collected_at: collectedAt }, ACTOR).catch(() => null);
  await db.create("OptimizationSignal", { metric: "data_driven_live_pct", value: report.live_pct, window_days: 0, collected_at: collectedAt }, ACTOR).catch(() => null);
}

// Human-in-the-loop queue: the AI-prepared outputs sitting in `awaiting_approval` for a human to approve/reject.
// This is the review surface for the by-design gates (money/identity/legal) AND any auto_ok domain that hasn't
// earned autonomy yet — the AI does the work and stores its output as the decision's `proposal`; a human signs
// off via autonomyApprove. Grouped by domain, newest first, output payload included so it can be reviewed inline.
export async function humanReviewQueue(limit = 100): Promise<{
  total: number; permanent_gate: number; earning: number;
  items: Array<{ decision_id: string; domain: string; subject_id: string | null; permanent_gate: boolean; mode: string; reason: string; output: unknown; at: string }>;
}> {
  const rows = await db.filter("AutonomyDecision", { stage: "awaiting_approval" }, "-created_at", limit).catch(() => []);
  const items = (rows || []).map((r: any) => ({
    decision_id: String(r.id ?? ""),
    domain: String(r.domain ?? ""),
    subject_id: r.subject_id ? String(r.subject_id) : null,
    permanent_gate: r.permanent_gate === true,
    mode: String(r.mode ?? ""),
    reason: String(r.reason ?? ""),
    output: r.proposal ?? null,
    at: String(r.created_at ?? r.created_date ?? ""),
  }));
  return {
    total: items.length,
    permanent_gate: items.filter((i) => i.permanent_gate).length,
    earning: items.filter((i) => !i.permanent_gate).length,
    items,
  };
}

// Read the stored trend for the two headline metrics (for the dashboard sparkline).
export async function coverageTrend(limit = 60): Promise<{ build: Array<{ at: string; value: number }>; live: Array<{ at: string; value: number }> }> {
  const b = await db.filter("OptimizationSignal", { metric: "data_driven_build_pct" }, "-created_date", limit).catch(() => []);
  const l = await db.filter("OptimizationSignal", { metric: "data_driven_live_pct" }, "-created_date", limit).catch(() => []);
  const map = (rows: any[]) => (rows || []).map((r) => ({ at: String(r.collected_at ?? r.created_date ?? ""), value: Number(r.value) || 0 })).reverse();
  return { build: map(b), live: map(l) };
}
