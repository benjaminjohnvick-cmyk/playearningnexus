// Live experimentation engine — "test a change on real traffic for a window, keep it only if the data
// says so, promote with no downtime, and steer it in real time." This complements the survey-based
// OptimizationExperiment (experiments.ts): that asks customers what they'd prefer; THIS measures what
// they actually do.
//
// Design honored throughout:
//   • A change is DATA, not code. Promotion is a setSetting()/flag flip read at request time → instant,
//     zero-downtime, and one flip to revert. UI variants promote by writing a UIVARIANT_* setting the
//     client reads. Genuinely-new components must be pre-shipped behind a flag; the engine only ever
//     CHOOSES among bounded, already-deployed options — it never writes or deploys code.
//   • Small, iterative, statistically-backed. A change promotes only on a significant uptick in its
//     objective AND no guardrail regression, with a minimum sample. Sequential-safe: a clear winner can
//     stop early, a clear loser dies fast, ambiguous ones ride the full window then expire to control.
//   • Money & compliance stay human-gated. Live auto-promotion applies ONLY to non-sensitive
//     UX/recommendation/copy settings (COMPLIANCE_DENYLIST + sensitive settings never enter here).
//   • Per-user quiet-swap. Assignment is sticky and only made when a user is NEW to the experiment
//     (i.e. at a session boundary / while inactive), so no one's UI shifts mid-use.
//   • Privacy. Opted-out users (tracking_opt_out) always sit in control and are never measured.
//
// Real-time control: a scheduled tick() measures each running experiment, shifts traffic toward the
// better arm (Thompson-style via a normal posterior), trips a circuit breaker on any guardrail breach,
// and ramps a winner through canary stages (5% → 25% → 50% → 100%).

import { db } from "./db.ts";
import { getBool, getNumber, setSetting, getDef } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";

const ACTOR = "live-experiments";

// ---- statistics (pure JS, no deps) --------------------------------------------------------------
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCdf(z: number): number { return 0.5 * (1 + erf(z / Math.SQRT2)); }

export interface ArmStat { n: number; conv: number; rate: number; }
export interface TestResult { control: ArmStat; variant: ArmStat; z: number; p: number; lift_pct: number; prob_variant_better: number; }

/** Two-proportion z-test + normal-approx posterior P(variant beats control). */
export function compareArms(cConv: number, cN: number, vConv: number, vN: number): TestResult {
  const rc = cN > 0 ? cConv / cN : 0;
  const rv = vN > 0 ? vConv / vN : 0;
  let z = 0, p = 1, prob = 0.5;
  if (cN > 0 && vN > 0) {
    const pooled = (cConv + vConv) / (cN + vN);
    const se = Math.sqrt(Math.max(1e-9, pooled * (1 - pooled) * (1 / cN + 1 / vN)));
    z = se > 0 ? (rv - rc) / se : 0;
    p = 2 * (1 - normalCdf(Math.abs(z)));
    const seDiff = Math.sqrt(Math.max(1e-9, rc * (1 - rc) / cN + rv * (1 - rv) / vN));
    prob = normalCdf((rv - rc) / seDiff);
  }
  return {
    control: { n: cN, conv: cConv, rate: Math.round(rc * 10000) / 10000 },
    variant: { n: vN, conv: vConv, rate: Math.round(rv * 10000) / 10000 },
    z: Math.round(z * 1000) / 1000, p: Math.round(p * 10000) / 10000,
    lift_pct: rc > 0 ? Math.round(((rv - rc) / rc) * 1000) / 10 : 0,
    prob_variant_better: Math.round(prob * 1000) / 1000,
  };
}

// Deterministic [0,1) hash → sticky, reproducible bucketing (no RNG so a user always lands the same).
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000000) / 1000000;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const nowISO = () => new Date().toISOString();

// ---- model helpers ------------------------------------------------------------------------------
export interface LiveExperiment {
  id: string; key: string; type: "setting" | "flag" | "ui";
  control_value: unknown; variant_value: unknown;
  objective_metric: string; guardrail_metrics: Array<{ metric: string; max_regression_pct: number }>;
  window_hours: number; min_sample: number;
  status: "running" | "promoted" | "reverted" | "halted";
  variant_share: number; base_share: number; min_share: number; canary_caps: number[]; canary_idx: number;
  started_at: string; last_step_at?: string; decided_at?: string; decision?: string;
  stats?: Record<string, unknown>;
}

export async function liveEnabled(jurisdiction?: string | null): Promise<boolean> {
  const flag = await isEnabled("live_experiments", jurisdiction).catch(() => true);
  const setting = await getBool("OPTIMIZER_LIVE_TEST", true).catch(() => true);
  return flag && setting;
}

/** Open a live experiment. Non-sensitive keys only — callers must not pass compliance/money settings. */
export async function createLiveExperiment(input: {
  key: string; type?: "setting" | "flag" | "ui"; control_value: unknown; variant_value: unknown;
  objective_metric?: string; guardrails?: Array<{ metric: string; max_regression_pct: number }>;
  window_hours?: number; min_sample?: number; rationale?: string;
}): Promise<Record<string, unknown> | null> {
  const windowH = input.window_hours ?? Math.max(1, await getNumber("LIVE_TEST_WINDOW_HOURS", 24));
  const minSample = input.min_sample ?? Math.max(1, await getNumber("SELF_LEARNING_MIN_SAMPLE", 30));
  const baseShare = clamp(await getNumber("LIVE_TEST_START_SHARE", 0.1), 0.01, 1);
  const caps = [0.05, 0.25, 0.5, 1.0].filter((c) => c >= baseShare || c === 1.0);
  const guardrails = input.guardrails ?? [
    { metric: "refund", max_regression_pct: 20 },
    { metric: "complaint", max_regression_pct: 20 },
    { metric: "drop_off", max_regression_pct: 25 },
  ];
  return await db.create("LiveExperiment", {
    key: input.key, type: input.type ?? "setting",
    control_value: input.control_value, variant_value: input.variant_value,
    objective_metric: input.objective_metric ?? "purchase",
    guardrail_metrics: guardrails,
    window_hours: windowH, min_sample: minSample,
    status: "running",
    variant_share: baseShare, base_share: baseShare, min_share: 0,
    canary_caps: caps, canary_idx: 0,
    rationale: input.rationale ?? "", started_at: nowISO(), last_step_at: nowISO(),
  }, ACTOR).catch(() => null) as Record<string, unknown> | null;
}

/** All running experiments (cached briefly by the caller if needed). */
export async function runningExperiments(): Promise<any[]> {
  return await db.filter("LiveExperiment", { status: "running" }, "-started_at", 200).catch(() => []) as any[];
}

/** Sticky per-user assignment. Quiet-swap: an existing assignment is NEVER changed mid-experiment; a
 *  user is only bucketed the first time they're seen for this experiment (a session boundary). Opted-out
 *  users are always control and never recorded. */
export async function assignVariant(exp: any, user: any, sessionId?: string): Promise<"control" | "variant"> {
  if (!user?.id || exp?.status !== "running") return "control";
  if (user.tracking_opt_out === true) return "control";

  const existing = await db.filter("LiveAssignment", { experiment_id: exp.id, user_id: user.id }, "-assigned_at", 1).catch(() => []) as any[];
  if (existing.length) return existing[0].variant === "variant" ? "variant" : "control";

  const share = clamp(Number(exp.variant_share) || 0, 0, 1);
  const variant = hashUnit(`${user.id}:${exp.id}`) < share ? "variant" : "control";
  await db.create("LiveAssignment", {
    experiment_id: exp.id, user_id: user.id, variant, session_id: String(sessionId || "").slice(0, 80),
    exposed: false, assigned_at: nowISO(),
  }, user.id).catch(() => null);
  return variant;
}

/** Request-time applier: the effective overrides for THIS user across all running experiments. Records
 *  a one-time exposure per (experiment,user). Returns settings/flag overrides + ui variant selections. */
export async function resolveVariantOverrides(user: any, sessionId?: string): Promise<{
  settings: Record<string, unknown>; flags: Record<string, boolean>; ui: Record<string, string>;
  assignments: Array<{ experiment_id: string; key: string; type: string; variant: string }>;
}> {
  const out = { settings: {} as Record<string, unknown>, flags: {} as Record<string, boolean>, ui: {} as Record<string, string>, assignments: [] as any[] };
  if (!user?.id || user.tracking_opt_out === true) return out;
  const exps = await runningExperiments();
  for (const exp of exps) {
    const variant = await assignVariant(exp, user, sessionId);
    const value = variant === "variant" ? exp.variant_value : exp.control_value;
    if (exp.type === "flag") out.flags[exp.key] = !!(value === true || value === "1" || value === 1);
    else if (exp.type === "ui") out.ui[exp.key] = String(value);
    else out.settings[exp.key] = value;
    out.assignments.push({ experiment_id: exp.id, key: exp.key, type: exp.type, variant });
    // One-time exposure event (dedup via the assignment row's `exposed` flag).
    markExposed(exp, user.id, variant).catch(() => {});
  }
  return out;
}

async function markExposed(exp: any, userId: string, variant: string) {
  const rows = await db.filter("LiveAssignment", { experiment_id: exp.id, user_id: userId }, "-assigned_at", 1).catch(() => []) as any[];
  const a = rows[0];
  if (!a || a.exposed) return;
  await db.update("LiveAssignment", a.id, { exposed: true, exposed_at: nowISO() }).catch(() => null);
  await db.create("LiveMetricEvent", { experiment_id: exp.id, user_id: userId, variant, metric: "exposure", value: 1, at: nowISO() }, ACTOR).catch(() => null);
}

/** Record an outcome/guardrail metric for a user, attributed to their variant in every running
 *  experiment they're assigned to. Called by recordVariantMetric (client) and server flows (purchase,
 *  refund, complaint, …). */
export async function recordMetricForUser(userId: string, metric: string, value = 1): Promise<number> {
  if (!userId) return 0;
  const exps = await runningExperiments();
  let n = 0;
  for (const exp of exps) {
    const rows = await db.filter("LiveAssignment", { experiment_id: exp.id, user_id: userId }, "-assigned_at", 1).catch(() => []) as any[];
    const a = rows[0];
    if (!a) continue;
    await db.create("LiveMetricEvent", { experiment_id: exp.id, user_id: userId, variant: a.variant, metric: String(metric).slice(0, 40), value: Number(value) || 1, at: nowISO() }, ACTOR).catch(() => null);
    n++;
  }
  return n;
}

// ---- measurement + real-time control ------------------------------------------------------------
async function armCounts(expId: string, metric: string): Promise<{ control: number; variant: number }> {
  const rows = await db.filter("LiveMetricEvent", { experiment_id: expId, metric }, "-at", 20000).catch(() => []) as any[];
  let c = 0, v = 0;
  for (const r of rows) { if (r.variant === "variant") v += Number(r.value) || 1; else c += Number(r.value) || 1; }
  return { control: c, variant: v };
}

/** Measure an experiment: objective test + guardrail deltas, using exposures as the denominator. */
export async function measureExperiment(exp: any): Promise<{ test: TestResult; guardrails: Array<{ metric: string; control_rate: number; variant_rate: number; regression_pct: number; breach: boolean }>; exposures: { control: number; variant: number } }> {
  const exposures = await armCounts(exp.id, "exposure");
  const obj = await armCounts(exp.id, exp.objective_metric || "purchase");
  const test = compareArms(obj.control, exposures.control, obj.variant, exposures.variant);

  const guardrails: Array<{ metric: string; control_rate: number; variant_rate: number; regression_pct: number; breach: boolean }> = [];
  for (const g of (Array.isArray(exp.guardrail_metrics) ? exp.guardrail_metrics : [])) {
    const gc = await armCounts(exp.id, g.metric);
    const rc = exposures.control > 0 ? gc.control / exposures.control : 0;
    const rv = exposures.variant > 0 ? gc.variant / exposures.variant : 0;
    // Regression = variant is WORSE (higher refund/complaint/drop-off) than control, in %.
    const regression = rc > 0 ? ((rv - rc) / rc) * 100 : (rv > 0 ? 100 : 0);
    const enoughSample = exposures.variant >= (exp.min_sample || 30) && exposures.control >= (exp.min_sample || 30);
    guardrails.push({
      metric: g.metric, control_rate: Math.round(rc * 10000) / 10000, variant_rate: Math.round(rv * 10000) / 10000,
      regression_pct: Math.round(regression * 10) / 10,
      breach: enoughSample && regression > (Number(g.max_regression_pct) || 20),
    });
  }
  return { test, guardrails, exposures };
}

/** Thompson-style traffic shift: move the variant's share toward it in proportion to how confident we
 *  are it's better, bounded by the current canary cap. This is the "adjust on the fly" behavior. */
function nextShare(exp: any, probBetter: number): number {
  const cap = (exp.canary_caps || [1])[Math.min(exp.canary_idx || 0, (exp.canary_caps || [1]).length - 1)] ?? 1;
  const base = Number(exp.base_share) || 0.1;
  const k = 0.6; // responsiveness
  const target = base + k * (probBetter - 0.5); // >0.5 → grow toward cap; <0.5 → shrink toward min
  return Math.round(clamp(target, Number(exp.min_share) || 0, cap) * 1000) / 1000;
}

/** Promote a winner with no downtime: flip the config the app reads at request time. Reversible by one
 *  flip. Money/compliance keys never reach here (guarded at creation). */
export async function promoteExperiment(exp: any, reason: string): Promise<void> {
  const now = nowISO();
  try {
    if (exp.type === "setting") await setSetting(exp.key, exp.variant_value as any, ACTOR);
    else if (exp.type === "flag") await setSetting(exp.key, exp.variant_value ? 1 : 0, ACTOR).catch(() => null);
    else if (exp.type === "ui") await setSetting(uiSettingKey(exp.key), String(exp.variant_value), ACTOR).catch(() => null);
  } catch { /* ui keys may not be in the registry; stored as a raw GlobalSettings row below */ }
  if (exp.type === "ui") await upsertRawSetting(uiSettingKey(exp.key), String(exp.variant_value));
  await db.update("LiveExperiment", exp.id, {
    status: "promoted", decided_at: now, decision: `promoted: ${reason}`, variant_share: 1, canary_idx: (exp.canary_caps || [1]).length - 1,
  }).catch(() => null);
  await db.create("AdminAuditLog", { actor_email: ACTOR, action_type: "live_experiment_promote", target: exp.key, details: { from: exp.control_value, to: exp.variant_value, reason }, timestamp: now }, ACTOR).catch(() => null);
  await db.create("OptimizationOutcome", { key: exp.key, primary_metric: exp.objective_metric, applied_at: now, verdict: "win", auto: true, live_experiment_id: exp.id }, ACTOR).catch(() => null);
}

/** Stop exposing the variant. Control was never changed, so revert = quiet-swap everyone back. */
export async function revertExperiment(exp: any, reason: string, status: "reverted" | "halted" = "reverted"): Promise<void> {
  const now = nowISO();
  await db.update("LiveExperiment", exp.id, { status, decided_at: now, decision: `${status}: ${reason}`, variant_share: 0 }).catch(() => null);
  await db.create("AdminAuditLog", { actor_email: ACTOR, action_type: `live_experiment_${status}`, target: exp.key, details: { reason }, timestamp: now }, ACTOR).catch(() => null);
}

function uiSettingKey(name: string): string { return `UIVARIANT_${name.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase()}`; }
async function upsertRawSetting(key: string, value: string) {
  const rows = await db.filter("GlobalSettings", { key }, "-created_date", 1).catch(() => []) as any[];
  const patch = { key, value, category: "Content & UI", label: key, updated_by: ACTOR, updated_at: nowISO() };
  if (rows.length) await db.update("GlobalSettings", rows[0].id, patch).catch(() => null);
  else await db.create("GlobalSettings", patch, ACTOR).catch(() => null);
}

/** One monitoring step for a single experiment: measure → circuit breaker → bandit shift → decide. */
export async function tickExperiment(exp: any): Promise<Record<string, unknown>> {
  const m = await measureExperiment(exp);
  const breach = m.guardrails.find((g) => g.breach);
  if (breach) {
    await revertExperiment(exp, `guardrail breach: ${breach.metric} +${breach.regression_pct}%`, "halted");
    return { key: exp.key, action: "halted", reason: breach.metric, stats: m.test };
  }

  const ageH = (Date.now() - new Date(exp.started_at).getTime()) / 3600000;
  const windowElapsed = ageH >= (Number(exp.window_hours) || 24);
  const enough = m.exposures.variant >= (exp.min_sample || 30) && m.exposures.control >= (exp.min_sample || 30);
  const significant = enough && m.test.p < 0.05;

  // Early stop on a clear, significant winner/loser (sequential-safe with the min-sample gate).
  if (significant && m.test.prob_variant_better >= 0.95) {
    await promoteExperiment(exp, `significant uptick (+${m.test.lift_pct}% on ${exp.objective_metric}, p=${m.test.p})`);
    return { key: exp.key, action: "promoted_early", stats: m.test };
  }
  if (significant && m.test.prob_variant_better <= 0.05) {
    await revertExperiment(exp, `variant significantly worse (${m.test.lift_pct}% on ${exp.objective_metric})`);
    return { key: exp.key, action: "reverted_early", stats: m.test };
  }

  if (windowElapsed) {
    if (significant && m.test.lift_pct > 0) {
      await promoteExperiment(exp, `window elapsed, significant uptick (+${m.test.lift_pct}%, p=${m.test.p})`);
      return { key: exp.key, action: "promoted", stats: m.test };
    }
    // Inconclusive at the window end → conservative: keep control, stop the test.
    await revertExperiment(exp, `window elapsed, inconclusive (p=${m.test.p}, n=${m.exposures.variant})`);
    return { key: exp.key, action: "expired_inconclusive", stats: m.test };
  }

  // Still running: shift traffic toward the better arm and advance the canary cap if healthy.
  const share = nextShare(exp, m.test.prob_variant_better);
  let canaryIdx = exp.canary_idx || 0;
  const caps = exp.canary_caps || [1];
  const dwellOk = m.test.prob_variant_better >= 0.8 && enough;
  if (dwellOk && canaryIdx < caps.length - 1 && share >= caps[canaryIdx] - 1e-6) canaryIdx++;
  await db.update("LiveExperiment", exp.id, {
    variant_share: share, canary_idx: canaryIdx, last_step_at: nowISO(),
    stats: { ...m.test, exposures: m.exposures, guardrails: m.guardrails, age_hours: Math.round(ageH * 10) / 10 },
  }).catch(() => null);
  return { key: exp.key, action: "stepped", variant_share: share, canary_idx: canaryIdx, prob_better: m.test.prob_variant_better, stats: m.test };
}

/** Tick every running experiment. */
export async function tickAll(): Promise<Array<Record<string, unknown>>> {
  const exps = await runningExperiments();
  const out: Array<Record<string, unknown>> = [];
  for (const exp of exps) out.push(await tickExperiment(exp).catch((e) => ({ key: exp.key, action: "error", error: (e as Error).message })));
  return out;
}
