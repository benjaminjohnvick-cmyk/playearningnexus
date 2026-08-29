// video-engine.ts — the admin AI Video Engine core.
//
// "Define a space of hundreds of millions of possible short-video concepts, sample it intelligently, render
// only the winners, test them on surfaces we own, measure quantifiable response, and re-bias the next sample
// from what won." This module is the pure, deterministic, unit-testable core: the DIMENSION registry +
// space sizing, the ε-greedy SAMPLER, predictive SCORING, the render-budget GOVERNOR, the quantifiable
// OUTCOME score, and the self-learning PLAYBOOK. The functions (aiVideoEngine*) orchestrate the LLM/render
// calls around this. Nothing here renders video, moves money, or calls an LLM.
//
// It deliberately reuses the platform's compliance guard (screenCreativeCopy) and mirrors the Creative
// Suite's self-learning approach, writing to the same OptimizationSignal + AgentLearningMemory primitives.

import { snapBool, snapNumber, snapString } from "./settings.ts";
import { screenCreativeCopy } from "./creative-suite.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 1) DIMENSION REGISTRY — the creative axes for a short video. The PRODUCT of value counts is the size of
//    the concept space (the honest "hundreds of millions"). Admin can override each axis' values via a
//    VIDEO_ENGINE_DIM_<KEY> comma-list setting; otherwise these defaults apply.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type VideoDimension =
  | "hook" | "visual_style" | "pacing" | "opening_shot" | "cta_style"
  | "music" | "caption_style" | "duration" | "voice" | "theme" | "trend_angle";

export const VIDEO_DIMENSIONS: VideoDimension[] = [
  "hook", "visual_style", "pacing", "opening_shot", "cta_style",
  "music", "caption_style", "duration", "voice", "theme", "trend_angle",
];

/** Default candidate values per axis. The product of these lengths is the default space size
 *  (≈ 112 million possible concepts with these defaults; expand any axis and it climbs into the billions). */
export const DEFAULT_DIMENSION_VALUES: Record<VideoDimension, string[]> = {
  hook: ["question", "bold-claim", "pattern-interrupt", "story-open", "stat-shock", "pov", "duet-bait", "controversy", "list-teaser"],
  visual_style: ["ugc-selfie", "screen-record", "fast-cut-montage", "cinematic", "animated-text", "greenscreen", "split-screen", "tutorial-overlay"],
  pacing: ["ultra-fast", "fast", "medium", "slow-build", "variable"],
  opening_shot: ["face-close", "product-in-hand", "text-only", "action", "before-after", "text-hook"],
  cta_style: ["direct", "soft", "curiosity-gap", "comment-bait", "none-until-end", "duet-cta"],
  music: ["trending-audio", "upbeat", "lofi", "dramatic", "none", "voiceover-only"],
  caption_style: ["karaoke", "minimal", "emoji-heavy", "none", "bold-word"],
  duration: ["6s", "10s", "15s", "30s", "45s", "60s"],
  voice: ["none", "river", "honey", "sunny", "storm", "nova"],
  theme: ["earn-online", "gaming", "savings", "tech-ai", "lifestyle", "motivational", "deals", "how-to"],
  // HOW a concept ties to what's currently popular. The specific live topic (e.g. "Mint Mobile price change")
  // is attached at generation time from the trend pool; this axis is the reusable, learnable style of the tie-in.
  trend_angle: ["news-jack", "current-event", "trending-meme", "seasonal", "viral-audio", "brand-moment"],
};

/** Read the (possibly admin-overridden) values for one dimension. Empty/blank setting → defaults. */
export function dimensionValues(dim: VideoDimension): string[] {
  const raw = snapString(`VIDEO_ENGINE_DIM_${dim.toUpperCase()}`, "");
  if (raw && raw.trim()) {
    const vals = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (vals.length) return vals;
  }
  return DEFAULT_DIMENSION_VALUES[dim];
}

/** The full current space: each dimension → its values. */
export function currentSpace(): Record<VideoDimension, string[]> {
  const out = {} as Record<VideoDimension, string[]>;
  for (const d of VIDEO_DIMENSIONS) out[d] = dimensionValues(d);
  return out;
}

/** Size of the concept space = product of value counts. This is the honest "hundreds of millions" number. */
export function spaceSize(space?: Record<VideoDimension, string[]>): number {
  const s = space || currentSpace();
  let n = 1;
  for (const d of VIDEO_DIMENSIONS) n *= Math.max(1, (s[d] || []).length);
  return n;
}

export type VideoConcept = Partial<Record<VideoDimension, string>>;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 2) SAMPLER — draw N concepts from the space with ε-greedy exploration. Deterministic given a seed, so it
//    is reproducible and unit-testable. "Exploit" picks the playbook's current winner on an axis; "explore"
//    picks a uniform-random value. This is how a space of hundreds of millions is searched a few thousand
//    concepts at a time, converging on winners.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Tiny deterministic PRNG (mulberry32) so sampling is reproducible from a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit string hash (for seeding from a string seed). */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function explorationPct(): number {
  return Math.min(1, Math.max(0, snapNumber("VIDEO_ENGINE_EXPLORATION_PCT", 0.2)));
}

/** A concept key so we can dedupe within a batch. */
export function conceptKey(c: VideoConcept): string {
  return VIDEO_DIMENSIONS.map((d) => `${d}=${c[d] ?? ""}`).join("|");
}

/** Draw up to `n` unique concepts. `top` (playbook.top, dimension→winning value) biases the exploit picks.
 *  `epsilon` fraction of each axis pick is uniform-random exploration. Deterministic given `seed`. */
export function sampleConcepts(
  n: number,
  opts?: { top?: Record<string, string>; epsilon?: number; seed?: string | number; space?: Record<VideoDimension, string[]> },
): VideoConcept[] {
  const space = opts?.space || currentSpace();
  const top = opts?.top || {};
  const epsilon = opts?.epsilon ?? explorationPct();
  const seedNum = typeof opts?.seed === "number" ? opts.seed : hashSeed(String(opts?.seed ?? "v1"));
  const rnd = mulberry32(seedNum);

  const want = Math.max(0, Math.min(Math.floor(n) || 0, spaceSize(space)));
  const seen = new Set<string>();
  const out: VideoConcept[] = [];
  let guard = 0;
  const maxTries = want * 40 + 50;

  while (out.length < want && guard++ < maxTries) {
    const c: VideoConcept = {};
    for (const d of VIDEO_DIMENSIONS) {
      const vals = space[d] || [];
      if (!vals.length) continue;
      const exploit = top[d] && vals.includes(top[d]);
      if (exploit && rnd() > epsilon) {
        c[d] = top[d];                                  // exploit the current winner
      } else {
        c[d] = vals[Math.floor(rnd() * vals.length)];   // explore
      }
    }
    const key = conceptKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 2b) TREND LAYER — ground concepts in what's currently popular on social + the news (news-jacking, à la
//     Mint Mobile's reactive marketing). A TrendSignal is one live, topical peg (a current event, a trending
//     meme/audio, a brand moment). The engine attaches a trend to each sampled concept, momentum-weighted, so
//     the generator can tie the hook to something people are already talking about RIGHT NOW. Trends are
//     volatile, so they are NOT part of the fixed combinatorial space — the reusable STYLE of the tie-in
//     (trend_angle) is the learnable axis; the specific topic is attached here at generation time.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TrendSignal {
  topic: string;            // e.g. "Mint Mobile price change"
  source?: string;          // e.g. "x", "tiktok", "google-trends", "news"
  momentum?: number;        // 0..100 relative heat; higher = more weight when picking
  hashtags?: string[];
  category?: string;        // e.g. "telecom", "gaming", "finance", "pop-culture"
  angle_hint?: string;      // maps naturally to a trend_angle value
  captured_at?: string;
}

export function trendMinMomentum(): number {
  return Math.max(0, snapNumber("VIDEO_ENGINE_TREND_MIN_MOMENTUM", 20));
}

/** Where trends come from: "llm" (ask a web-aware model each refresh), "manual" (admin-entered list),
 *  or "none" (skip the trend layer entirely). Default "llm". */
export function trendProvider(): string {
  return (snapString("VIDEO_ENGINE_TREND_PROVIDER", "llm") || "llm").trim().toLowerCase();
}

/** Keep only trends at/above the momentum floor, hottest first. Pure. */
export function usableTrends(trends: TrendSignal[]): TrendSignal[] {
  const floor = trendMinMomentum();
  return (trends || [])
    .filter((t) => t && t.topic && (Number(t.momentum) || 0) >= floor)
    .sort((a, b) => (Number(b.momentum) || 0) - (Number(a.momentum) || 0));
}

/** Momentum-weighted pick from a trend list using a provided RNG in [0,1). Hotter trends are likelier.
 *  Returns undefined if the list is empty. Pure/deterministic given `r`. */
export function pickTrend(trends: TrendSignal[], r: number): TrendSignal | undefined {
  const list = usableTrends(trends);
  if (!list.length) return undefined;
  const total = list.reduce((s, t) => s + Math.max(1, Number(t.momentum) || 1), 0);
  let x = Math.max(0, Math.min(1, r)) * total;
  for (const t of list) {
    x -= Math.max(1, Number(t.momentum) || 1);
    if (x <= 0) return t;
  }
  return list[list.length - 1];
}

export interface EnrichedConcept { concept: VideoConcept; trend?: TrendSignal; }

/** Attach a momentum-weighted live trend to each concept (deterministic given `seed`). If `trends` is empty
 *  the concepts pass through untouched (trend layer simply off). When a trend carries an `angle_hint` that is
 *  a valid trend_angle value, it overrides the sampled trend_angle so the style matches the actual peg. */
export function attachTrends(concepts: VideoConcept[], trends: TrendSignal[], seed: string | number = "trend"): EnrichedConcept[] {
  const list = usableTrends(trends);
  const seedNum = typeof seed === "number" ? seed : hashSeed(String(seed));
  const rnd = mulberry32(seedNum);
  const angles = DEFAULT_DIMENSION_VALUES.trend_angle;
  return concepts.map((concept) => {
    if (!list.length) return { concept };
    const trend = pickTrend(list, rnd());
    const c = { ...concept };
    if (trend?.angle_hint && angles.includes(trend.angle_hint)) c.trend_angle = trend.angle_hint;
    return { concept: c, trend };
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 3) COMPLIANCE + PREDICTIVE SCORE — screen a concept's copy and give it a 0–100 pre-flight score before
//    a cent of render spend. Blends playbook alignment with a hard compliance gate.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ConceptScoreInput {
  concept: VideoConcept;
  script?: string;         // generated copy, screened for compliance
  caption?: string;
}

/** Screen a concept's text. `ok=false` only on a BLOCK-severity claim (ROI/earnings/"2x"/risk-free …). */
export function screenConcept(input: ConceptScoreInput): { ok: boolean; violations: unknown[] } {
  const v1 = screenCreativeCopy(input.script ?? "");
  const v2 = screenCreativeCopy(input.caption ?? "");
  const violations = [...v1.violations, ...v2.violations];
  return { ok: v1.ok && v2.ok, violations };
}

/** 0–100 predictive score. Playbook alignment (how many of the concept's axis values are current winners) +
 *  a small base, hard-capped at 40 if the copy is non-compliant (it can't ship, so it can't score well). */
export function scoreConcept(input: ConceptScoreInput, playbook?: VideoPlaybook): number {
  let base = 50;
  let aligned = 0, axes = 0;
  if (playbook && playbook.sample_size > 0) {
    for (const dim of VIDEO_DIMENSIONS) {
      const val = input.concept[dim];
      if (!val) continue;
      const ranking = playbook.dimensions.find((d) => d.dimension === dim);
      if (!ranking || !ranking.ranked.length) continue;
      axes++;
      const stat = ranking.ranked.find((r) => r.value === val);
      if (!stat) continue;
      const best = Math.max(...ranking.ranked.map((r) => Math.abs(r.score)), 0.0001);
      aligned += Math.max(-1, Math.min(1, stat.score / best));
    }
  }
  const alignBonus = axes ? (aligned / axes) * 40 : 0;
  let total = base + alignBonus;
  const compliant = screenConcept(input).ok;
  if (!compliant) total = Math.min(total, 40);
  return Math.max(0, Math.min(100, Math.round(total)));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 4) RENDER BUDGET GOVERNOR — the PHASED gate. Concepts are generated cheap (script/storyboard/thumbnail);
//    only the top scorers, within a daily count budget AND a daily $ cap, get rendered by a paid vendor.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RenderBudget {
  daily_render_max: number;     // videos actually rendered per day
  daily_spend_cap_usd: number;  // hard $ ceiling per day
  est_cost_per_render_usd: number;
  min_render_score: number;     // a concept must score at least this to be render-eligible
  provider: string;             // "none" = phased concepts only, zero spend
}

export function renderBudget(): RenderBudget {
  return {
    daily_render_max: Math.max(0, snapNumber("VIDEO_ENGINE_DAILY_RENDER_MAX", 200)),
    daily_spend_cap_usd: Math.max(0, snapNumber("VIDEO_ENGINE_DAILY_SPEND_CAP_USD", 100)),
    est_cost_per_render_usd: Math.max(0, snapNumber("VIDEO_ENGINE_EST_COST_PER_RENDER_USD", 0.25)),
    min_render_score: Math.max(0, snapNumber("VIDEO_ENGINE_RENDER_MIN_SCORE", 70)),
    provider: (snapString("VIDEO_ENGINE_RENDER_PROVIDER", "none") || "none").trim().toLowerCase(),
  };
}

export function dailyConceptBudget(): number {
  return Math.max(0, snapNumber("VIDEO_ENGINE_DAILY_CONCEPT_MAX", 5000));
}

export interface ScoredConcept { concept: VideoConcept; score: number; id?: string; compliant?: boolean; }

/** Pick the concepts to render: compliant, score ≥ min, highest score first, limited by BOTH the remaining
 *  daily render count and the remaining daily $ cap. Returns the selection + the budget math. Pure. */
export function selectForRender(
  concepts: ScoredConcept[],
  opts?: { rendered_today?: number; spent_today_usd?: number; limit?: number; budget?: RenderBudget },
): { selected: ScoredConcept[]; est_cost_usd: number; reason: string } {
  const b = opts?.budget || renderBudget();
  if (b.provider === "none") return { selected: [], est_cost_usd: 0, reason: "render provider is 'none' — concepts only, no spend" };

  const renderedToday = Math.max(0, opts?.rendered_today || 0);
  const spentToday = Math.max(0, opts?.spent_today_usd || 0);
  const countRoom = Math.max(0, b.daily_render_max - renderedToday);
  const dollarRoom = Math.max(0, b.daily_spend_cap_usd - spentToday);
  const perCost = b.est_cost_per_render_usd > 0 ? b.est_cost_per_render_usd : 0.0001;
  const dollarRoomCount = Math.floor(dollarRoom / perCost);
  const hardLimit = Math.min(countRoom, dollarRoomCount, opts?.limit ?? Number.POSITIVE_INFINITY);

  const eligible = concepts
    .filter((c) => c.compliant !== false && c.score >= b.min_render_score)
    .sort((a, z) => z.score - a.score);

  const selected = eligible.slice(0, Math.max(0, hardLimit));
  const est = Math.round(selected.length * b.est_cost_per_render_usd * 100) / 100;
  let reason = `${selected.length} selected (count room ${countRoom}, $ room ${dollarRoom.toFixed(2)})`;
  if (!selected.length) {
    if (hardLimit <= 0) reason = "daily render/$ budget exhausted";
    else if (!eligible.length) reason = `no concept scored ≥ ${b.min_render_score}`;
  }
  return { selected, est_cost_usd: est, reason };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 5) QUANTIFIABLE OUTCOME SCORE — turn a rendered video's real metrics into one signed performance weight.
//    Each term is admin-weighted. This is what makes the tailoring "quantifiable."
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VideoMetrics {
  impressions?: number;
  three_sec_views?: number;
  avg_watch_seconds?: number;
  length_seconds?: number;
  completions?: number;
  clicks?: number;
  shares?: number;
  saves?: number;
  conversions?: number;
}

export interface OutcomeWeights { watch: number; completion: number; ctr: number; share: number; save: number; conversion: number; }

export function outcomeWeights(): OutcomeWeights {
  return {
    watch: snapNumber("VIDEO_ENGINE_W_WATCH", 1.0),
    completion: snapNumber("VIDEO_ENGINE_W_COMPLETION", 1.0),
    ctr: snapNumber("VIDEO_ENGINE_W_CTR", 1.5),
    share: snapNumber("VIDEO_ENGINE_W_SHARE", 2.0),
    save: snapNumber("VIDEO_ENGINE_W_SAVE", 1.5),
    conversion: snapNumber("VIDEO_ENGINE_W_CONVERSION", 3.0),
  };
}

/** Normalized rates from raw metrics (all 0..1-ish). */
export function metricRates(m: VideoMetrics): { watch: number; completion: number; ctr: number; share: number; save: number; conversion: number } {
  const impr = Math.max(1, Number(m.impressions) || 0);
  const len = Math.max(1, Number(m.length_seconds) || 1);
  const watch = Math.max(0, Math.min(1, (Number(m.avg_watch_seconds) || 0) / len));
  const threeSec = Math.max(1, Number(m.three_sec_views) || impr);
  const completion = Math.max(0, Math.min(1, (Number(m.completions) || 0) / threeSec));
  const ctr = Math.max(0, Math.min(1, (Number(m.clicks) || 0) / impr));
  const share = Math.max(0, Math.min(1, (Number(m.shares) || 0) / impr));
  const save = Math.max(0, Math.min(1, (Number(m.saves) || 0) / impr));
  const conversion = Math.max(0, Math.min(1, (Number(m.conversions) || 0) / impr));
  return { watch, completion, ctr, share, save, conversion };
}

/** A single blended performance value (higher = better) for a video's metrics. */
export function videoPerformance(m: VideoMetrics, w?: OutcomeWeights): number {
  const r = metricRates(m);
  const ww = w || outcomeWeights();
  const v = r.watch * ww.watch + r.completion * ww.completion + r.ctr * ww.ctr
    + r.share * ww.share + r.save * ww.save + r.conversion * ww.conversion;
  return Math.round(v * 10000) / 10000;
}

/** Signed learning weight for a video, RELATIVE to the batch mean, so a video is judged against its cohort.
 *  Positive → its dimension values get promoted; negative → demoted. */
export function scoreVideoOutcome(m: VideoMetrics, batchMean?: number, w?: OutcomeWeights): number {
  const perf = videoPerformance(m, w);
  const mean = typeof batchMean === "number" ? batchMean : 0;
  return Math.round((perf - mean) * 10000) / 10000;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 6) SELF-LEARNING PLAYBOOK — aggregate signed outcomes per (dimension, value) with sample-smoothing so a
//    proven winner outranks a fluke, then expose the winning value per axis to re-bias the next sample.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VideoAttrStat { value: string; weight: number; impressions: number; score: number; }
export interface VideoDimRanking { dimension: VideoDimension; ranked: VideoAttrStat[]; }
export interface VideoPlaybook {
  dimensions: VideoDimRanking[];
  sample_size: number;
  updated_at: string;
  top: Record<string, string>;   // dimension → winning value (for the sampler)
}

export interface VideoOutcomeRow { attributes?: VideoConcept; weight?: number; impressions?: number; }

function smoothed(weight: number, impressions: number): number {
  const n = Math.max(0, impressions);
  const prior = 2;
  return weight / (n + prior);
}

/** Build the playbook from recorded outcomes. */
export function buildVideoPlaybook(rows: VideoOutcomeRow[], todayISO = ""): VideoPlaybook {
  const acc: Record<string, Record<string, { weight: number; impressions: number }>> = {};
  let sample = 0;
  for (const r of rows || []) {
    const wt = Number(r.weight) || 0;
    const impr = Math.max(1, Number(r.impressions) || 1);
    const attrs = r.attributes || {};
    let counted = false;
    for (const dim of VIDEO_DIMENSIONS) {
      const val = attrs[dim];
      if (!val) continue;
      counted = true;
      (acc[dim] ??= {});
      (acc[dim][val] ??= { weight: 0, impressions: 0 });
      acc[dim][val].weight += wt;
      acc[dim][val].impressions += impr;
    }
    if (counted) sample++;
  }
  const dimensions: VideoDimRanking[] = [];
  const top: Record<string, string> = {};
  for (const dim of VIDEO_DIMENSIONS) {
    const vals = acc[dim];
    if (!vals) continue;
    const ranked: VideoAttrStat[] = Object.entries(vals).map(([value, s]) => ({
      value,
      weight: Math.round(s.weight * 1000) / 1000,
      impressions: s.impressions,
      score: Math.round(smoothed(s.weight, s.impressions) * 100000) / 100000,
    })).sort((a, b) => b.score - a.score);
    dimensions.push({ dimension: dim, ranked });
    if (ranked.length && ranked[0].score > 0) top[dim] = ranked[0].value;
  }
  return { dimensions, sample_size: sample, updated_at: todayISO, top };
}

/** Plain-language recommendations from the playbook for the admin panel. */
export function videoRecommendations(pb: VideoPlaybook, limit = 8): string[] {
  const recs: string[] = [];
  for (const d of pb.dimensions) {
    const best = d.ranked[0];
    const worst = d.ranked[d.ranked.length - 1];
    if (best && best.score > 0) recs.push(`Lean into ${d.dimension} = "${best.value}" — strongest measured response.`);
    if (worst && worst.score < 0 && worst.value !== best?.value) recs.push(`Cut ${d.dimension} = "${worst.value}" — underperforming.`);
  }
  if (!recs.length) recs.push("Not enough measured outcomes yet — render a batch and test it to start the loop.");
  return recs.slice(0, limit);
}

export const videoEngineEnabled = () => snapBool("VIDEO_ENGINE_ENABLED", true);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 7) DB BRIDGE — record video outcomes as the SAME learning primitives the platform already reads, and load
//    them back for the playbook. Reuses OptimizationSignal + AgentLearningMemory (no new learning tables).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const VIDEO_AGENT = "video_engine_ai";

type Dbi = {
  create: (name: string, doc: Record<string, unknown>) => Promise<unknown>;
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
};

export interface RecordVideoOutcomeInput {
  concept_id?: string;
  attributes?: VideoConcept;
  weight?: number;
  impressions?: number;
  metrics?: VideoMetrics;
  todayISO?: string;
}

/** Persist one video outcome as learning signals. Best-effort; never throws into the caller. */
export async function recordVideoOutcome(dbi: Dbi, o: RecordVideoOutcomeInput): Promise<void> {
  const at = o.todayISO || "";
  const attrs = o.attributes || {};
  const weight = Number(o.weight) || 0;
  await dbi.create("OptimizationSignal", {
    kind: "video_outcome",
    key: "video:short",
    concept_id: o.concept_id ?? null,
    attributes: attrs,
    weight,
    impressions: Math.max(0, Number(o.impressions) || 0),
    metrics: o.metrics ?? null,
    note: `video outcome (weight ${weight})`,
    created_at: at,
  }).catch(() => null);
  await dbi.create("AgentLearningMemory", {
    agent_name: VIDEO_AGENT,
    type: "video_outcome",
    target: "video:short",
    success: weight >= 0,
    provisional: true,
    improvement_notes: weight >= 0
      ? `A short video with ${JSON.stringify(attrs)} outperformed its batch — favor these attributes.`
      : `A short video with ${JSON.stringify(attrs)} underperformed — vary these attributes.`,
    attributes: attrs,
    recorded_at: at, created_at: at,
  }).catch(() => null);
}

/** Load recent video outcomes as playbook input. Bounded read (recent N). */
export async function loadVideoOutcomes(dbi: Dbi, limit = 5000): Promise<VideoOutcomeRow[]> {
  const rows = await dbi.filter("OptimizationSignal", { kind: "video_outcome" }, "-created_at", Math.max(1, limit)).catch(() => []) as Record<string, unknown>[];
  return (rows || []).map((r) => ({
    attributes: (r.attributes as VideoConcept) || {},
    weight: Number(r.weight) || 0,
    impressions: Math.max(0, Number(r.impressions) || 0),
  }));
}

/** Build the platform video playbook straight from stored outcomes. */
export async function videoPlaybookFor(dbi: Dbi, todayISO = ""): Promise<VideoPlaybook> {
  const rows = await loadVideoOutcomes(dbi);
  return buildVideoPlaybook(rows, todayISO);
}
