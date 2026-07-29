// AI self-learning optimization engine.
//
// The platform is data-driven: every adjustable setting (the settings.ts REGISTRY) can be tuned by
// an AI loop that (1) COLLECTS signals from real activity, (2) RECOMMENDS a change backed by that
// data (LLM rationale + a bandit/hill-climb over history), (3) APPLIES it — automatically for
// non-sensitive knobs within their registry bounds, or QUEUES it for admin approval for
// money/legal-sensitive knobs — and (4) LEARNS: it measures the objective before/after each change,
// keeps wins, reverts losses, and remembers the best value per setting.
//
// Guardrails (deliberate): sensitive settings (def.sensitive) and any money/price key are NEVER
// auto-applied — they become pending recommendations. Every change is clamped to the registry
// min/max and written to AdminAuditLog. This composes with the compliance guardrails already in
// place (bounds in coerce, the sensitive-flag audit, the feature-flag kill-switches).

import { db } from "./db.ts";
import { getDef, getNumber, setSetting } from "./settings.ts";
import { Core } from "./integrations.ts";
import { requireExperiment, createExperimentForProposal } from "./experiments.ts";
import { createLiveExperiment, liveEnabled } from "./live-experiments.ts";
import { topBaseSegment } from "./personalization.ts";

const ACTOR = "ai-optimizer";

// When segment testing is on, the optimizer tests a non-sensitive change on the most active segment
// FIRST (per-user personalization); a strong segment winner then graduates to a site-wide test. When
// off (or no populous segment exists), it tests site-wide directly. Either way, promotion is a
// no-downtime config flip and money/compliance stays out.
async function targetSegment(): Promise<string | null> {
  const { getBool } = await import("./settings.ts");
  if (!(await getBool("OPTIMIZER_SEGMENT_TESTING", true).catch(() => true))) return null;
  return await topBaseSegment().catch(() => null);
}

// Map an aggregate optimizer objective to the per-user event a live A/B counts as a "success".
function liveObjectiveFor(objective: string): string {
  const o = (objective || "").toLowerCase();
  if (o.includes("purchase") || o.includes("order") || o.includes("revenue") || o.includes("conversion")) return "purchase";
  if (o.includes("cart")) return "add_to_cart";
  if (o.includes("click") || o.includes("ctr")) return "click_through";
  if (o.includes("checkout")) return "begin_checkout";
  return "purchase";
}
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n: number, lo?: number, hi?: number) =>
  Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, n));

// ---- What the AI is allowed to optimize, and the objective each setting moves ---------------------
// goal: whether we want the objective metric maximized or minimized.
// priceLike: money/price keys — always QUEUED for approval even if not flagged `sensitive`.
export interface Optimizable {
  key: string;
  objective: string;        // a metric name from the signal snapshot
  goal: "max" | "min";
  priceLike?: boolean;
  step?: number;            // exploration step size (in the setting's own units)
}

// COMPLIANCE / GUARDRAIL DENYLIST — the AI must NEVER tune these, not even as a recommendation.
// They are legal walls (age gate, tax, sweepstakes), deliberate safety guardrails (spend/earn caps,
// fraud/quality thresholds, refund/anti-spam policy, infra concurrency), or compliance-adjacent
// economics (the PPC earning ceilings, affiliate commission structure) that a human owns by design.
export const COMPLIANCE_DENYLIST = new Set<string>([
  // Legal
  "MIN_AGE", "TAX_BACKUP_WITHHOLDING_RATE", "TAX_1099_THRESHOLD", "SWEEPSTAKES_REG_THRESHOLD",
  "POINTS_CASHABLE", "TERMS_VERSION", "MAINTENANCE_MODE",
  // Safety guardrails (admin sets deliberately)
  "DAILY_EARN_CAP_USD", "AI_DAILY_SPEND_CAP_USD", "AI_COST_PER_1K_TOKENS", "MIN_PAYOUT_USD",
  "AI_FULFILLMENT_MAX_ORDER_USD", "SURVEY_FRAUD_SPEEDER_SECONDS", "GAME_AUTO_APPROVE_MIN_RATING",
  "REFUND_WINDOW_DAYS", "LLM_CONCURRENCY", "AGENT_MAX_STEPS", "EMAIL_FREQUENCY_CAP_PER_WEEK",
  // Compliance-adjacent economics (the no-penalty PPC ceilings + affiliate structure)
  "PREMIUM_ANNUAL_POINTS_CEILING", "PREMIUM_DAILY_EARN_CAP",
  "AFFILIATE_ACTIVATION_THRESHOLD", "AFFILIATE_TIER_BRONZE_MIN", "AFFILIATE_TIER_SILVER_MIN",
  "AFFILIATE_TIER_GOLD_MIN", "AFFILIATE_TIER_PLATINUM_MIN",
  "AFFILIATE_ONGOING_RATE_BRONZE", "AFFILIATE_ONGOING_RATE_SILVER", "AFFILIATE_ONGOING_RATE_GOLD",
  "AFFILIATE_ONGOING_RATE_PLATINUM", "AFFILIATE_BOUNTY_BRONZE", "AFFILIATE_BOUNTY_SILVER",
  "AFFILIATE_BOUNTY_GOLD", "AFFILIATE_BOUNTY_PLATINUM",
  // Points Boost COST GOVERNORS — the ceiling + caps are admin-owned and never auto-tuned, so the
  // feature's cost stays hard-bounded even as the optimizer tunes the rate knobs for engagement.
  "BOOST_MAX_PCT", "BOOST_DAILY_CAP_USD", "BOOST_LIFETIME_CAP_USD",
]);

// Every safe, consumer-backed numeric setting the engine optimizes. Money/price knobs are
// priceLike → they only ever produce recommendations for admin approval (never silent). Non-price
// engagement knobs auto-apply within bounds and revert on regression. Anything with no live consumer
// or no honest objective is intentionally omitted (the engine won't tune a no-op or a guardrail).
export const OPTIMIZABLE: Optimizable[] = [
  // Pricing / economy (price-like → propose for approval, never silent)
  { key: "STORE_MARKUP", objective: "store_revenue", goal: "max", priceLike: true, step: 0.02 },
  { key: "POINT_VALUE_CENTS", objective: "store_revenue", goal: "max", priceLike: true, step: 0.1 },
  { key: "MEMBERSHIP_DAILY_FEE", objective: "membership_revenue", goal: "max", priceLike: true, step: 0.1 },
  { key: "TOURNAMENT_ENTRY_FEE", objective: "contest_revenue", goal: "max", priceLike: true, step: 0.25 },
  { key: "CONTEST_POWERUP_PRICE", objective: "contest_revenue", goal: "max", priceLike: true, step: 0.1 },
  { key: "DEVELOPER_REVENUE_SHARE", objective: "developer_supply", goal: "max", priceLike: true, step: 0.05 },
  { key: "TOURNAMENT_PLATFORM_CUT", objective: "contest_revenue", goal: "max", priceLike: true, step: 0.02 },
  { key: "CREATOR_PLATFORM_FEE", objective: "creator_supply", goal: "max", priceLike: true, step: 0.02 },
  // Engagement / rewards
  { key: "SURVEY_REWARD_CONVERSION", objective: "survey_completion_rate", goal: "max", step: 0.05 },
  { key: "XP_PER_LEVEL", objective: "engagement_rate", goal: "max", step: 10 },
  { key: "LEADERBOARD_RESET_DAYS", objective: "engagement_rate", goal: "max", step: 1 },
  { key: "STREAK_DAILY_REWARD", objective: "engagement_rate", goal: "max", priceLike: true, step: 0.05 },
  // Points Boost rate knobs — AI-tuned + live-A/B-tested for engagement. Safe to auto-tune because the
  // real cost is bounded by the USD caps (BOOST_DAILY_CAP_USD / BOOST_LIFETIME_CAP_USD), which are
  // sensitive/admin-owned and NOT in this list — so the optimizer can raise the "feel" freely while the
  // spend ceiling never moves. These flow through the same live-holdout + guardrail pipeline.
  { key: "BOOST_BASE_RATE", objective: "engagement_rate", goal: "max", step: 0.1 },
  { key: "BOOST_STREAK_RATE", objective: "engagement_rate", goal: "max", step: 0.05 },
  { key: "BOOST_VAULT_BONUS_PCT", objective: "engagement_rate", goal: "max", step: 0.25 },
].filter((o) => !COMPLIANCE_DENYLIST.has(o.key));

const byKey = Object.fromEntries(OPTIMIZABLE.map((o) => [o.key, o]));

// ---- 1. COLLECT: compute a snapshot of objective metrics from real activity --------------------
export interface Snapshot { [metric: string]: number }

function windowIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Compute the current metric snapshot from live entities and persist an OptimizationSignal per
 *  metric (so trends are queryable). `days` is the look-back window. */
export async function collectSignals(days = 14): Promise<Snapshot> {
  const since = windowIso(days);
  const snap: Snapshot = {};

  // Store
  const orders = await db.filter("Order", {}, "-created_date", 2000).catch(() => []);
  const recentOrders = orders.filter((o: any) => (o.created_date ?? o.created_at) >= since);
  const completed = recentOrders.filter((o: any) => ["completed", "fulfilled", "external_order_placed", "verified"].includes(o.status));
  const revenue = completed.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);
  snap.store_orders = recentOrders.length;
  snap.store_completed = completed.length;
  snap.store_revenue = round2(revenue);
  snap.store_aov = completed.length ? round2(revenue / completed.length) : 0;
  snap.store_conversion_rate = recentOrders.length ? round2(completed.length / recentOrders.length) : 0;

  // Surveys
  const responses = await db.filter("PPCSurveyResponse", {}, "-created_date", 4000).catch(() => []);
  const recentResp = responses.filter((r: any) => (r.created_date ?? r.created_at) >= since);
  const done = recentResp.filter((r: any) => r.completed === true || r.status === "completed");
  snap.survey_responses = recentResp.length;
  snap.survey_completions = done.length;
  snap.survey_completion_rate = recentResp.length ? round2(done.length / recentResp.length) : 0;
  const surveysCreated = await db.filter("PPCSurvey", {}, "-created_date", 2000).catch(() => []);
  snap.survey_creation_volume = surveysCreated.filter((s: any) => (s.created_date ?? s.created_at) >= since).length;

  // Membership
  const mems = await db.filter("PremiumMembership", {}, "-created_date", 4000).catch(() => []);
  const activeMems = mems.filter((m: any) => m.status === "active" || m.is_active === true);
  const fee = await getNumber("MEMBERSHIP_DAILY_FEE", 1);
  snap.membership_active = activeMems.length;
  snap.membership_revenue = round2(activeMems.length * fee);

  // Contests / tournaments
  const parts = await db.filter("TournamentParticipant", {}, "-created_date", 3000).catch(() => []);
  const powerups = await db.filter("ContestPowerUp", {}, "-created_date", 3000).catch(() => []);
  const entryFee = await getNumber("TOURNAMENT_ENTRY_FEE", 0);
  const puPrice = await getNumber("CONTEST_POWERUP_PRICE", 0.5);
  const recentParts = parts.filter((p: any) => (p.created_date ?? p.registered_at) >= since && p.entry_fee_paid);
  const recentPu = powerups.filter((p: any) => (p.created_date ?? p.used_at) >= since);
  snap.contest_revenue = round2(recentParts.length * entryFee + recentPu.length * puPrice);

  // Supply (developers / creators)
  const devs = await db.filter("DeveloperPayout", {}, "-created_date", 1000).catch(() => []);
  snap.developer_supply = devs.filter((d: any) => (d.created_date ?? d.created_at) >= since).length;
  const creators = await db.filter("CreatorSubscriptionTier", {}, "-created_date", 1000).catch(() => []);
  snap.creator_supply = creators.length;

  // Engagement (daily earnings activity as a proxy)
  const earnings = await db.filter("DailyEarnings", {}, "-created_date", 5000).catch(() => []);
  const recentEarn = earnings.filter((e: any) => (e.date ?? e.created_date) >= since.slice(0, 10));
  const activeUsers = new Set(recentEarn.map((e: any) => e.user_id)).size;
  const totalUsers = (await db.filter("User", {}, undefined, 20000).catch(() => [])).length || 1;
  snap.engagement_rate = round2(activeUsers / totalUsers);
  snap.active_users = activeUsers;

  // Pricing feedback (customer survey responses about price)
  const pf = await db.filter("PricingFeedback", {}, "-created_date", 3000).catch(() => []);
  const recentPf = pf.filter((f: any) => (f.created_date ?? f.collected_at) >= since);
  const prices = recentPf.map((f: any) => Number(f.price_point)).filter((n: number) => Number.isFinite(n));
  snap.pricing_feedback_count = recentPf.length;
  snap.pricing_feedback_avg_acceptable = prices.length ? round2(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  // Persist each metric as a signal row for trend history.
  const collectedAt = new Date().toISOString();
  for (const [metric, value] of Object.entries(snap)) {
    await db.create("OptimizationSignal", { metric, value, window_days: days, collected_at: collectedAt }, ACTOR).catch(() => null);
  }
  return snap;
}

// ---- 2. RECOMMEND: propose a change backed by data (LLM rationale + bandit over history) --------
export interface Proposal {
  key: string; current: number; proposed: number; direction: "up" | "down" | "hold";
  rationale: string; confidence: number; objective: string; objectiveValue: number;
}

async function learningFor(key: string): Promise<any | null> {
  const rows = await db.filter("AILearningState", { key }, "-updated_at", 1).catch(() => []);
  return rows[0] ?? null;
}

/** Decide the next value for one setting. Uses the learning memory (which direction has historically
 *  improved the objective) plus, when the LLM is available, a data-grounded recommendation. Always
 *  clamps to the registry bounds and never proposes a change outside them. */
export async function proposeChange(o: Optimizable, snap: Snapshot): Promise<Proposal | null> {
  if (COMPLIANCE_DENYLIST.has(o.key)) return null; // never tune legal/guardrail settings
  const def = getDef(o.key);
  if (!def || def.type !== "number") return null;
  const current = await getNumber(o.key, Number(def.default) || 0);
  const step = o.step ?? Math.max(0.01, Math.abs(current) * 0.1);
  const objectiveValue = Number(snap[o.objective] ?? 0);
  const learn = await learningFor(o.key);

  // Baseline direction from learning memory: keep moving the way that last improved the objective.
  let direction: "up" | "down" | "hold" = "up";
  if (learn?.last_direction === "down") direction = "down";
  // If we already know a best value and we're at it with high confidence, hold.
  if (learn && Number(learn.confidence ?? 0) >= 0.8 && Math.abs(Number(learn.best_value) - current) < step / 2) {
    direction = "hold";
  }

  let rationale = `Bandit step on ${o.objective} (${o.goal}); current ${o.objective}=${objectiveValue}.`;
  let confidence = learn ? Number(learn.confidence ?? 0.3) : 0.3;

  // LLM refinement (optional — only if a provider key is configured). It sees the live snapshot and
  // the setting's bounds and returns a direction + one-line rationale grounded in the data.
  if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
    try {
      const out = await Core.InvokeLLM({
        prompt:
          `You tune a play-to-earn platform setting using live data. Setting "${def.label}" (${o.key}) is ` +
          `currently ${current}${def.unit ? " " + def.unit : ""}. Objective: ${o.goal}imize "${o.objective}", ` +
          `currently ${objectiveValue}. Allowed range: ${def.min ?? "-∞"}..${def.max ?? "∞"}. ` +
          `Recent metrics: ${JSON.stringify(snap)}. Recommend whether to move the setting "up", "down", or "hold" ` +
          `by roughly ${step}, and give a one-sentence data-grounded reason. Be conservative with money settings.`,
        response_json_schema: { type: "object", properties: { direction: { type: "string", enum: ["up", "down", "hold"] }, reason: { type: "string" }, confidence: { type: "number" } }, required: ["direction", "reason"] },
      }) as any;
      if (out?.direction) direction = out.direction;
      if (out?.reason) rationale = String(out.reason);
      if (Number.isFinite(out?.confidence)) confidence = Math.max(confidence, Number(out.confidence));
    } catch { /* LLM optional — fall back to the bandit direction */ }
  }

  if (direction === "hold") return null;
  const delta = direction === "up" ? step : -step;
  const proposed = round2(clamp(current + delta, def.min, def.max));
  if (proposed === current) return null; // already at a bound in that direction
  return { key: o.key, current, proposed, direction, rationale, confidence: round2(confidence), objective: o.objective, objectiveValue };
}

// ---- 3. APPLY or QUEUE ---------------------------------------------------------------------------
export interface ApplyResult { key: string; status: "auto_applied" | "pending" | "experiment" | "live_experiment"; from: number; to: number; recommendation_id?: string; experiment_id?: string }

/** Change-gating: unless disabled, EVERY proposed change is first tested with customers as an A/B
 *  experiment (mockup + survey) and only applied once customers favor it (see experiments.ts).
 *  When experiments are off: non-sensitive → apply now (audited, bounded, outcome-tracked);
 *  sensitive/price → pending admin recommendation. */
export async function applyOrQueue(p: Proposal, snap: Snapshot): Promise<ApplyResult> {
  if (COMPLIANCE_DENYLIST.has(p.key)) throw new Error(`Refusing to optimize compliance/guardrail setting ${p.key}`);
  const def = getDef(p.key)!;
  const priceLike = !!byKey[p.key]?.priceLike;

  // Preferred path: a NON-SENSITIVE change is deployed as a LIVE A/B holdout on a small slice of real
  // traffic and only promoted if the live data shows a significant uptick with no guardrail regression
  // (bandit traffic-shift + circuit breaker + canary ramp, all no-downtime). Money/compliance-sensitive
  // changes never enter this — they fall through to the human-gated recommendation path below.
  if (!def.sensitive && !priceLike && await liveEnabled().catch(() => false)) {
    const segment = await targetSegment().catch(() => null);
    const exp = await createLiveExperiment({
      key: p.key, type: "setting", control_value: p.current, variant_value: p.proposed,
      objective_metric: liveObjectiveFor(p.objective), rationale: p.rationale, segment,
    }).catch(() => null);
    if (exp) return { key: p.key, status: "live_experiment", from: p.current, to: p.proposed, experiment_id: (exp as any).id };
    // If live creation failed, fall through to the survey/apply paths below.
  }

  // Test with customers before launching, per the change-gating policy.
  if (await requireExperiment()) {
    const exp = await createExperimentForProposal(p, snap).catch(() => null);
    return { key: p.key, status: "experiment", from: p.current, to: p.proposed, experiment_id: (exp as any)?.id };
  }
  const o = byKey[p.key];
  const mustApprove = !!def.sensitive || !!o?.priceLike;
  const now = new Date().toISOString();

  const rec = await db.create("OptimizationRecommendation", {
    key: p.key, category: def.category, current_value: p.current, proposed_value: p.proposed,
    direction: p.direction, rationale: p.rationale, confidence: p.confidence,
    objective: p.objective, objective_value: p.objectiveValue, sensitive: mustApprove,
    evidence: snap, status: mustApprove ? "pending" : "auto_applied", created_at: now,
  }, ACTOR).catch(() => null);
  const recId = (rec as any)?.id;

  if (mustApprove) {
    return { key: p.key, status: "pending", from: p.current, to: p.proposed, recommendation_id: recId };
  }

  // Auto-apply (clamped again inside setSetting/coerce).
  await setSetting(p.key, p.proposed, ACTOR);
  await db.create("AdminAuditLog", {
    actor_email: ACTOR, action_type: "ai_setting_update", target: p.key,
    details: { from: p.current, to: p.proposed, rationale: p.rationale, objective: p.objective, auto: true },
    timestamp: now,
  }, ACTOR).catch(() => null);
  // Open an outcome row: baseline objective now, measured again on the next reconcile.
  await db.create("OptimizationOutcome", {
    key: p.key, from_value: p.current, to_value: p.proposed, primary_metric: p.objective,
    before_value: p.objectiveValue, applied_at: now, verdict: "pending",
    recommendation_id: recId, auto: true,
  }, ACTOR).catch(() => null);
  return { key: p.key, status: "auto_applied", from: p.current, to: p.proposed, recommendation_id: recId };
}

// ---- 4. LEARN: measure outcomes of past changes, keep wins, revert losses -----------------------
/** For each pending outcome older than `minAgeHours`, compare the objective now vs. before. Update
 *  the per-setting learning memory, and auto-revert non-sensitive changes that made the objective
 *  worse. Sensitive changes were admin-approved, so they are recorded but not auto-reverted. */
export async function measureOutcomes(snap: Snapshot, minAgeHours = 24): Promise<Array<Record<string, unknown>>> {
  const pending = await db.filter("OptimizationOutcome", { verdict: "pending" }, "-applied_at", 500).catch(() => []);
  const cutoff = Date.now() - minAgeHours * 3600000;
  const results: Array<Record<string, unknown>> = [];

  for (const oc of pending) {
    const appliedAt = new Date(String(oc.applied_at)).getTime();
    if (!(appliedAt < cutoff)) continue;
    const o = byKey[String(oc.key)];
    const after = Number(snap[String(oc.primary_metric)] ?? 0);
    const before = Number(oc.before_value ?? 0);
    const goal = o?.goal ?? "max";
    const improved = goal === "max" ? after > before : after < before;
    const lift = before !== 0 ? round2(((after - before) / Math.abs(before)) * 100) : 0;
    const verdict = Math.abs(after - before) < 1e-9 ? "neutral" : improved ? "win" : "loss";

    await db.update("OptimizationOutcome", String(oc.id), { after_value: after, lift_pct: lift, verdict, measured_at: new Date().toISOString() }).catch(() => null);

    // Revert auto-applied losses back to the prior value.
    let reverted = false;
    if (verdict === "loss" && oc.auto === true) {
      try { await setSetting(String(oc.key), Number(oc.from_value), ACTOR); reverted = true; } catch { /* ignore */ }
      await db.update("OptimizationOutcome", String(oc.id), { reverted: true }).catch(() => null);
      await db.create("AdminAuditLog", { actor_email: ACTOR, action_type: "ai_setting_revert", target: String(oc.key), details: { from: oc.to_value, to: oc.from_value, reason: "objective regressed", lift_pct: lift }, timestamp: new Date().toISOString() }, ACTOR).catch(() => null);
    }

    await recordLearning(String(oc.key), Number(reverted ? oc.from_value : oc.to_value), after, verdict, o?.goal ?? "max");
    results.push({ key: oc.key, verdict, lift_pct: lift, reverted });
  }
  return results;
}

/** Update the per-setting memory: track the best value seen for the objective and which direction
 *  has been improving it, and grow confidence as evidence accumulates. */
export async function recordLearning(key: string, value: number, metricValue: number, verdict: string, goal: "max" | "min") {
  const existing = await learningFor(key);
  const history: any[] = Array.isArray(existing?.history) ? existing.history : [];
  history.push({ value, metric: metricValue, verdict, at: new Date().toISOString() });
  const trimmed = history.slice(-50);

  // Best value = the one with the best objective observed.
  let best = trimmed[0];
  for (const h of trimmed) {
    if (goal === "max" ? Number(h.metric) > Number(best.metric) : Number(h.metric) < Number(best.metric)) best = h;
  }
  const lastDir = verdict === "win" ? (existing?.last_direction ?? "up") : (existing?.last_direction === "down" ? "up" : "down");
  const confidence = Math.min(0.95, 0.2 + trimmed.length * 0.05);
  const patch = { key, best_value: best?.value ?? value, best_metric_value: best?.metric ?? metricValue, last_direction: lastDir, confidence, history: trimmed, updated_at: new Date().toISOString() };

  if (existing?.id) await db.update("AILearningState", existing.id, patch).catch(() => null);
  else await db.create("AILearningState", patch, ACTOR).catch(() => null);
}

// ---- Orchestration: one full optimization pass --------------------------------------------------
export interface OptimizeOptions { only?: string[]; measure?: boolean }

/** Run a complete cycle: collect → (measure past outcomes) → recommend → apply/queue. Returns a
 *  report. `only` restricts to a subset of setting keys (e.g. just the pricing keys). */
export async function runOptimizationPass(opts: OptimizeOptions = {}): Promise<Record<string, unknown>> {
  const snap = await collectSignals();
  const measured = opts.measure === false ? [] : await measureOutcomes(snap);
  const targets = OPTIMIZABLE.filter((o) => !opts.only || opts.only.includes(o.key));

  const applied: ApplyResult[] = [];
  for (const o of targets) {
    const p = await proposeChange(o, snap).catch(() => null);
    if (!p) continue;
    const r = await applyOrQueue(p, snap).catch(() => null);
    if (r) applied.push(r);
  }
  return {
    ran_at: new Date().toISOString(),
    snapshot: snap,
    measured,
    auto_applied: applied.filter((a) => a.status === "auto_applied"),
    pending_approval: applied.filter((a) => a.status === "pending"),
    in_experiment: applied.filter((a) => a.status === "experiment"),
  };
}
