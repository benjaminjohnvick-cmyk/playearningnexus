// creative-suite.ts — the end-to-end AI Creative Suite shared across all three advertiser tiers.
//
// One coherent system on top of the pieces the platform already has: LLM/image generation
// (Core.InvokeLLM / Core.GenerateImage), the A/B infra (ABTest / AdCreativeTest / runAdCreativeABTest),
// and the self-improvement loop (OptimizationSignal + AgentLearningMemory). This module is the pure,
// testable core: the ad-FORMAT registry, the per-TIER capability matrix, the self-learning creative
// PLAYBOOK, predictive creative SCORING, and the COMPLIANCE guard that keeps generated copy inside the
// platform's spine (no ROI / earnings / "2x" / risk-free claims). The functions
// (aiCreativeSuiteGenerate / …Experiment / …Learn / …Status) orchestrate the LLM calls around this.
//
// Nothing here moves money or calls an LLM — it is deterministic logic so it can be unit-tested offline.

import { snapBool, snapNumber, snapString } from "./settings.ts";
import { db } from "./db.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 1) AD FORMAT REGISTRY — every ad type/format the suite can produce, with real specs.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type CreativeMedium = "text" | "image" | "video" | "native" | "email";

export interface AdFormatSpec {
  key: string;
  label: string;
  medium: CreativeMedium;
  surfaces: string[];            // where it runs
  headline_max?: number;         // char budgets for the generator
  body_max?: number;
  cta_max?: number;
  width?: number;                // for image formats
  height?: number;
  notes: string;
}

/** The full format catalog. `dimensions` follow IAB / common social sizes so generated image briefs are
 *  production-ready. Add a format here and it is instantly offered to every tier that allows it. */
export const AD_FORMATS: AdFormatSpec[] = [
  { key: "interstitial", label: "Between-survey interstitial", medium: "image", surfaces: ["between-survey"], headline_max: 60, body_max: 120, cta_max: 20, width: 640, height: 480, notes: "The platform's own priority ad slot." },
  { key: "social_post", label: "Social feed post", medium: "text", surfaces: ["social-feed", "facebook", "instagram", "x", "linkedin"], headline_max: 80, body_max: 280, cta_max: 20, notes: "Clearly labeled as an ad; square image optional." },
  { key: "social_story", label: "Story / Reel (vertical)", medium: "image", surfaces: ["instagram", "tiktok", "social-feed"], headline_max: 40, body_max: 90, cta_max: 16, width: 1080, height: 1920, notes: "Full-bleed vertical; minimal text." },
  { key: "square_1080", label: "Square post creative", medium: "image", surfaces: ["instagram", "facebook", "social-feed"], headline_max: 50, body_max: 120, cta_max: 18, width: 1080, height: 1080, notes: "1:1 feed creative." },
  { key: "banner_medium_rectangle", label: "Banner — medium rectangle", medium: "image", surfaces: ["display"], headline_max: 40, body_max: 60, cta_max: 16, width: 300, height: 250, notes: "IAB 300×250." },
  { key: "banner_leaderboard", label: "Banner — leaderboard", medium: "image", surfaces: ["display"], headline_max: 40, body_max: 50, cta_max: 16, width: 728, height: 90, notes: "IAB 728×90." },
  { key: "banner_mobile", label: "Banner — mobile", medium: "image", surfaces: ["display", "mobile"], headline_max: 30, body_max: 40, cta_max: 14, width: 320, height: 50, notes: "IAB 320×50." },
  { key: "banner_skyscraper", label: "Banner — wide skyscraper", medium: "image", surfaces: ["display"], headline_max: 40, body_max: 80, cta_max: 16, width: 160, height: 600, notes: "IAB 160×600." },
  { key: "native_card", label: "Native / sponsored card", medium: "native", surfaces: ["feed", "content"], headline_max: 50, body_max: 90, cta_max: 18, notes: "Blends with content; must be labeled sponsored." },
  { key: "search_headline", label: "Search / PPC headlines", medium: "text", surfaces: ["search"], headline_max: 30, body_max: 90, cta_max: 15, notes: "Multiple short headlines + descriptions." },
  { key: "product_page_copy", label: "Product-page / landing copy", medium: "text", surfaces: ["storefront", "landing"], headline_max: 70, body_max: 600, cta_max: 24, notes: "Long-form persuasive copy + bullets." },
  { key: "email_creative", label: "Email creative", medium: "email", surfaces: ["email"], headline_max: 60, body_max: 800, cta_max: 24, notes: "Subject line + preview + body + CTA." },
  { key: "carousel", label: "Carousel (multi-frame)", medium: "image", surfaces: ["instagram", "facebook"], headline_max: 40, body_max: 80, cta_max: 16, width: 1080, height: 1080, notes: "3–5 frames, one message across." },
  { key: "video_script_short", label: "Short video script (6–15s)", medium: "video", surfaces: ["tiktok", "reels", "shorts"], headline_max: 40, body_max: 400, cta_max: 16, notes: "Hook-first script + shot list + on-screen text; no video is rendered." },
  { key: "video_script_long", label: "Video script / storyboard (30–60s)", medium: "video", surfaces: ["youtube", "connected-tv"], headline_max: 50, body_max: 900, cta_max: 20, notes: "Scene-by-scene storyboard + VO; script only." },
];

export const adFormat = (key: string): AdFormatSpec | undefined => AD_FORMATS.find((f) => f.key === key);
export const allFormatKeys = (): string[] => AD_FORMATS.map((f) => f.key);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 2) TIER CAPABILITY MATRIX — what each tier's creative suite can do. All admin-tunable via settings.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type SuiteTier = "tier1" | "tier2" | "tier3";
export type Autonomy = "suggest" | "assist" | "auto";      // suggest=recommend only; assist=1-click apply; auto=self-driving
export type LearningDepth = "basic" | "advanced" | "predictive";

export interface CreativeSuiteCaps {
  tier: SuiteTier;
  enabled: boolean;
  monthly_generations: number;        // creatives the suite will generate per 4-week period (0 = unlimited)
  max_variants_per_brief: number;     // variants produced from a single brief per format
  formats: string[];                  // allowed format keys
  max_concurrent_experiments: number; // A/B or multivariate tests running at once (0 = unlimited)
  multivariate: boolean;              // beyond simple A/B
  autonomy_ceiling: Autonomy;         // the most autonomous mode this tier may use
  learning_depth: LearningDepth;
  image_generation: boolean;
  video_scripts: boolean;
  brand_kit: boolean;                 // brand-voice / palette memory conditions generation
  localization: boolean;              // audience/locale variants
  predictive_scoring: boolean;        // pre-flight creative score
  auto_refresh: boolean;              // fatigue detection → auto-regenerate
}

const UNL = 0; // sentinel: 0 means "unlimited"

/** Baseline per-tier capabilities. Every field is overridable via a CREATIVE_SUITE_* setting so an admin can
 *  retune the ladder without a deploy. Tiers are strictly monotonic (a higher tier never has less). */
export function creativeSuiteTierCaps(tier: SuiteTier): CreativeSuiteCaps {
  const on = suiteEnabled();
  if (tier === "tier3") {
    return {
      tier, enabled: on,
      monthly_generations: Math.max(0, snapNumber("CREATIVE_SUITE_T3_MONTHLY_GENERATIONS", UNL)),
      max_variants_per_brief: Math.max(2, snapNumber("CREATIVE_SUITE_T3_VARIANTS", 12)),
      formats: allowedFormats("CREATIVE_SUITE_T3_FORMATS", allFormatKeys()),
      max_concurrent_experiments: Math.max(0, snapNumber("CREATIVE_SUITE_T3_EXPERIMENTS", UNL)),
      multivariate: snapBool("CREATIVE_SUITE_T3_MULTIVARIATE", true),
      autonomy_ceiling: autonomyOf("CREATIVE_SUITE_T3_AUTONOMY", "auto"),
      learning_depth: depthOf("CREATIVE_SUITE_T3_LEARNING", "predictive"),
      image_generation: snapBool("CREATIVE_SUITE_T3_IMAGES", true),
      video_scripts: snapBool("CREATIVE_SUITE_T3_VIDEO", true),
      brand_kit: snapBool("CREATIVE_SUITE_T3_BRAND_KIT", true),
      localization: snapBool("CREATIVE_SUITE_T3_LOCALIZATION", true),
      predictive_scoring: snapBool("CREATIVE_SUITE_T3_PREDICTIVE", true),
      auto_refresh: snapBool("CREATIVE_SUITE_T3_AUTO_REFRESH", true),
    };
  }
  if (tier === "tier2") {
    return {
      tier, enabled: on,
      monthly_generations: Math.max(0, snapNumber("CREATIVE_SUITE_T2_MONTHLY_GENERATIONS", 400)),
      max_variants_per_brief: Math.max(2, snapNumber("CREATIVE_SUITE_T2_VARIANTS", 8)),
      formats: allowedFormats("CREATIVE_SUITE_T2_FORMATS", allFormatKeys()),
      max_concurrent_experiments: Math.max(0, snapNumber("CREATIVE_SUITE_T2_EXPERIMENTS", 10)),
      multivariate: snapBool("CREATIVE_SUITE_T2_MULTIVARIATE", true),
      autonomy_ceiling: autonomyOf("CREATIVE_SUITE_T2_AUTONOMY", "assist"),
      learning_depth: depthOf("CREATIVE_SUITE_T2_LEARNING", "advanced"),
      image_generation: snapBool("CREATIVE_SUITE_T2_IMAGES", true),
      video_scripts: snapBool("CREATIVE_SUITE_T2_VIDEO", true),
      brand_kit: snapBool("CREATIVE_SUITE_T2_BRAND_KIT", true),
      localization: snapBool("CREATIVE_SUITE_T2_LOCALIZATION", true),
      predictive_scoring: snapBool("CREATIVE_SUITE_T2_PREDICTIVE", true),
      auto_refresh: snapBool("CREATIVE_SUITE_T2_AUTO_REFRESH", true),
    };
  }
  // tier1 — the full core suite (the founding / Tier 1 advertiser)
  return {
    tier: "tier1", enabled: on,
    monthly_generations: Math.max(0, snapNumber("CREATIVE_SUITE_T1_MONTHLY_GENERATIONS", 120)),
    max_variants_per_brief: Math.max(2, snapNumber("CREATIVE_SUITE_T1_VARIANTS", 5)),
    formats: allowedFormats("CREATIVE_SUITE_T1_FORMATS", allFormatKeys()),
    max_concurrent_experiments: Math.max(0, snapNumber("CREATIVE_SUITE_T1_EXPERIMENTS", 3)),
    multivariate: snapBool("CREATIVE_SUITE_T1_MULTIVARIATE", false),
    autonomy_ceiling: autonomyOf("CREATIVE_SUITE_T1_AUTONOMY", "assist"),
    learning_depth: depthOf("CREATIVE_SUITE_T1_LEARNING", "advanced"),
    image_generation: snapBool("CREATIVE_SUITE_T1_IMAGES", true),
    video_scripts: snapBool("CREATIVE_SUITE_T1_VIDEO", true),
    brand_kit: snapBool("CREATIVE_SUITE_T1_BRAND_KIT", true),
    localization: snapBool("CREATIVE_SUITE_T1_LOCALIZATION", false),
    predictive_scoring: snapBool("CREATIVE_SUITE_T1_PREDICTIVE", true),
    auto_refresh: snapBool("CREATIVE_SUITE_T1_AUTO_REFRESH", false),
  };
}

export const suiteEnabled = () => snapBool("CREATIVE_SUITE_ENABLED", true);
export const normalizeTier = (t: unknown): SuiteTier =>
  (t === "tier3" || t === "tier2") ? t : "tier1";

function allowedFormats(key: string, fallback: string[]): string[] {
  const raw = snapString(key, "");
  if (!raw.trim()) return fallback;
  const wanted = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = wanted.filter((k) => AD_FORMATS.some((f) => f.key === k));
  return valid.length ? valid : fallback;
}
function autonomyOf(key: string, fallback: Autonomy): Autonomy {
  const v = snapString(key, "").trim().toLowerCase();
  return (v === "suggest" || v === "assist" || v === "auto") ? v : fallback;
}
function depthOf(key: string, fallback: LearningDepth): LearningDepth {
  const v = snapString(key, "").trim().toLowerCase();
  return (v === "basic" || v === "advanced" || v === "predictive") ? v : fallback;
}

/** Clamp a requested autonomy mode to the tier's ceiling AND the global admin cap. Default global cap is
 *  "assist" so nothing goes fully self-driving until an admin explicitly raises CREATIVE_SUITE_AUTONOMY_CAP —
 *  this keeps the compliance posture safe by default. */
export function effectiveAutonomy(tier: SuiteTier, requested?: string): Autonomy {
  const order: Autonomy[] = ["suggest", "assist", "auto"];
  const cap = creativeSuiteTierCaps(tier).autonomy_ceiling;
  const globalCap = autonomyOf("CREATIVE_SUITE_AUTONOMY_CAP", "assist");
  const want = (requested && order.includes(requested as Autonomy)) ? (requested as Autonomy) : "suggest";
  const idx = Math.min(order.indexOf(want), order.indexOf(cap), order.indexOf(globalCap));
  return order[Math.max(0, idx)];
}

/** Is a format available to this tier? */
export function formatAllowed(tier: SuiteTier, formatKey: string): boolean {
  return creativeSuiteTierCaps(tier).formats.includes(formatKey);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 3) COMPLIANCE GUARD — screen generated copy so the suite never emits a claim the platform's spine bans.
//    Advertising VALUE delivered, never revenue/ROI/return; no guaranteed earnings; no risk-free framing.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CopyViolation { rule: string; match: string; severity: "block" | "warn"; }

const BANNED_PATTERNS: { rule: string; re: RegExp; severity: "block" | "warn" }[] = [
  { rule: "guaranteed_return", re: /\bguarantee(?:d|s)?\b[^.!?]{0,40}\b(return|profit|income|roi|earnings|results?)\b/i, severity: "block" },
  { rule: "multiple_of_money", re: /\b\d+\s*x\b[^.!?]{0,20}\b(return|money|profit|roi|back)\b|\b(double|triple|quadruple)\s+your\s+money\b/i, severity: "block" },
  { rule: "risk_free", re: /\b(risk[-\s]?free|zero[-\s]?risk|no[-\s]?risk|guaranteed\s+profit)\b/i, severity: "block" },
  { rule: "get_rich", re: /\b(get\s+rich|make\s+(?:you\s+)?rich|financial\s+freedom\s+guaranteed|retire\s+early\s+guaranteed)\b/i, severity: "block" },
  { rule: "guaranteed_earnings_amount", re: /\b(earn|make)\b[^.!?]{0,20}\$\s?\d[\d,]*[^.!?]{0,20}\b(guaranteed|per\s+day|daily|a\s+day|每)\b/i, severity: "block" },
  { rule: "passive_income_guarantee", re: /\bpassive\s+income\b[^.!?]{0,20}\bguaranteed\b|\bguaranteed\b[^.!?]{0,20}\bpassive\s+income\b/i, severity: "block" },
  { rule: "investment_framing", re: /\b(invest(?:ment)?|returns?\s+on\s+your\s+money|grow\s+your\s+money)\b/i, severity: "warn" },
  { rule: "unsubstantiated_superlative", re: /\b(guaranteed\s+(?:best|#1|number\s*one))\b/i, severity: "warn" },
];

/** Screen ad copy. Returns any violations; `ok` is false only when a BLOCK-severity rule fires. The generator
 *  regenerates blocked variants and drops any that still fail, so a non-compliant creative never ships. */
export function screenCreativeCopy(text: string): { ok: boolean; violations: CopyViolation[] } {
  const s = String(text ?? "");
  const violations: CopyViolation[] = [];
  for (const p of BANNED_PATTERNS) {
    const m = s.match(p.re);
    if (m) violations.push({ rule: p.rule, match: m[0].slice(0, 60), severity: p.severity });
  }
  const blocked = violations.some((v) => v.severity === "block");
  return { ok: !blocked, violations };
}

/** Screen every text field of a generated creative at once. */
export function screenCreative(creative: Record<string, unknown>): { ok: boolean; violations: CopyViolation[] } {
  const fields = ["headline", "body", "cta", "subject", "primary_text", "description", "script"];
  const all: CopyViolation[] = [];
  for (const f of fields) {
    if (typeof creative[f] === "string") all.push(...screenCreativeCopy(creative[f] as string).violations);
  }
  return { ok: !all.some((v) => v.severity === "block"), violations: all };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 4) SELF-LEARNING PLAYBOOK — turn recorded creative outcomes into ranked winning attributes, which then
//    bias the next generation batch (self-improving) and drive recommendations.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The creative attribute dimensions the suite learns over. Each generated creative is tagged with a value
 *  on each axis; outcomes then teach which values win. */
export const CREATIVE_DIMENSIONS = [
  "format", "hook", "tone", "length", "cta_style", "visual_style", "emoji", "urgency", "audience",
] as const;
export type CreativeDimension = typeof CREATIVE_DIMENSIONS[number];

export interface AttributeStat { value: string; wins: number; impressions: number; weight: number; score: number; }
export interface DimensionRanking { dimension: CreativeDimension; ranked: AttributeStat[]; }
export interface CreativePlaybook {
  dimensions: DimensionRanking[];
  sample_size: number;
  updated_at: string;
  top: Record<string, string>;   // dimension → best value (convenience for prompt-conditioning)
}

/** A learning row: one recorded outcome for a creative, carrying its attribute tags + a performance signal.
 *  Produced by recordCreativeOutcome and read back here. `weight` is the outcome strength (positive = good). */
export interface CreativeOutcomeRow {
  attributes?: Partial<Record<CreativeDimension, string>>;
  weight?: number;               // signed strength (e.g. CTR-based, or posted=+2 / skipped=-1)
  impressions?: number;
}

/** Wilson-ish lower bound flavor without the sqrt: a smoothed score that rewards consistent winners and
 *  discounts thin samples, so a 1-of-1 fluke never outranks a proven value. Pure + deterministic. */
function smoothedScore(wins: number, impressions: number): number {
  const n = Math.max(0, impressions);
  const w = wins;                      // wins may be negative (net signal)
  const prior = 2;                     // pseudo-count pulls thin samples toward neutral
  return (w) / (n + prior);
}

/** Build the playbook from recorded outcomes. Aggregates signed weight per (dimension, value), then ranks
 *  each dimension's values by a sample-smoothed score. This is the "self-learning" core: feed it the
 *  outcome history and it tells the generator what is currently winning. */
export function buildCreativePlaybook(rows: CreativeOutcomeRow[], todayISO = ""): CreativePlaybook {
  const acc: Record<string, Record<string, { wins: number; impressions: number }>> = {};
  let sample = 0;
  for (const r of rows || []) {
    const wt = Number(r.weight) || 0;
    const impr = Math.max(1, Number(r.impressions) || 1);
    const attrs = r.attributes || {};
    let counted = false;
    for (const dim of CREATIVE_DIMENSIONS) {
      const val = attrs[dim];
      if (!val) continue;
      counted = true;
      (acc[dim] ??= {});
      (acc[dim][val] ??= { wins: 0, impressions: 0 });
      acc[dim][val].wins += wt;
      acc[dim][val].impressions += impr;
    }
    if (counted) sample++;
  }
  const dimensions: DimensionRanking[] = [];
  const top: Record<string, string> = {};
  for (const dim of CREATIVE_DIMENSIONS) {
    const vals = acc[dim];
    if (!vals) continue;
    const ranked: AttributeStat[] = Object.entries(vals).map(([value, s]) => ({
      value,
      wins: Math.round(s.wins * 100) / 100,
      impressions: s.impressions,
      weight: Math.round(s.wins * 100) / 100,
      score: Math.round(smoothedScore(s.wins, s.impressions) * 10000) / 10000,
    })).sort((a, b) => b.score - a.score);
    dimensions.push({ dimension: dim, ranked });
    if (ranked.length && ranked[0].score > 0) top[dim] = ranked[0].value;
  }
  return { dimensions, sample_size: sample, updated_at: todayISO, top };
}

/** Turn the playbook into short, human-readable recommendations for the advertiser dashboard. */
export function playbookRecommendations(pb: CreativePlaybook, limit = 6): string[] {
  const recs: string[] = [];
  for (const d of pb.dimensions) {
    const best = d.ranked[0];
    const worst = d.ranked[d.ranked.length - 1];
    if (best && best.score > 0) recs.push(`Lean into ${d.dimension} = "${best.value}" — it's your strongest performer.`);
    if (worst && worst.score < 0 && worst.value !== best?.value) recs.push(`Pull back on ${d.dimension} = "${worst.value}" — it's underperforming.`);
  }
  if (!recs.length) recs.push("Not enough outcome data yet — run an A/B test to start the learning loop.");
  return recs.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 5) PREDICTIVE CREATIVE SCORE — a 0–100 pre-flight score for a creative, before any spend.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ScoreInputs {
  attributes?: Partial<Record<CreativeDimension, string>>;
  headline?: string;
  body?: string;
  cta?: string;
  format?: string;
  compliant?: boolean;
}

/** Predict a 0–100 creative score. Blends (a) how well the creative's attributes match the learned playbook,
 *  (b) craft heuristics (headline length in the sweet spot, a present CTA, not over-long body), and
 *  (c) a hard compliance gate (a non-compliant creative can't score above 40, because it can't ship).
 *  Deterministic and unit-tested; when the playbook is empty it falls back to craft heuristics alone. */
export function scoreCreative(input: ScoreInputs, playbook?: CreativePlaybook): number {
  let craft = 50;
  const h = (input.headline ?? "").trim();
  const spec = input.format ? adFormat(input.format) : undefined;
  const hMax = spec?.headline_max ?? 60;
  if (h) {
    const ratio = h.length / hMax;
    if (ratio > 0 && ratio <= 1) craft += 10;              // fits the format
    if (h.length >= 6 && h.length <= Math.min(hMax, 60)) craft += 6;  // punchy
    if (ratio > 1) craft -= 12;                            // over budget → truncation risk
  } else craft -= 10;
  const cta = (input.cta ?? "").trim();
  if (cta) craft += 8; else craft -= 6;
  const body = (input.body ?? "").trim();
  const bMax = spec?.body_max ?? 200;
  if (body && body.length > bMax) craft -= 8;

  // Playbook alignment: reward attributes that currently win, penalize known losers.
  let align = 0, aligned = 0;
  if (playbook && playbook.sample_size > 0 && input.attributes) {
    for (const d of playbook.dimensions) {
      const val = input.attributes[d.dimension];
      if (!val) continue;
      const stat = d.ranked.find((r) => r.value === val);
      if (!stat) continue;
      aligned++;
      // Normalize this value's score against the dimension's best (|best| as the scale).
      const best = Math.max(...d.ranked.map((r) => Math.abs(r.score)), 0.0001);
      align += Math.max(-1, Math.min(1, stat.score / best)) * 20;
    }
  }
  const alignAvg = aligned ? align / aligned : 0;

  let total = craft + alignAvg;
  if (input.compliant === false) total = Math.min(total, 40);   // can't ship → capped
  return Math.max(0, Math.min(100, Math.round(total)));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 6) FATIGUE DETECTION — flag a creative that has worn out so auto-refresh can regenerate it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FatigueInput { impressions: number; ctr_recent: number; ctr_baseline: number; age_days: number; }

/** A creative is fatigued when it has enough impressions AND its recent CTR has fallen a set fraction below
 *  its own baseline (or it's simply old). Thresholds are admin-tunable. Pure. */
export function isFatigued(f: FatigueInput): { fatigued: boolean; reason: string } {
  const minImpr = Math.max(0, snapNumber("CREATIVE_SUITE_FATIGUE_MIN_IMPRESSIONS", 5000));
  const dropPct = Math.min(1, Math.max(0, snapNumber("CREATIVE_SUITE_FATIGUE_CTR_DROP_PCT", 0.3)));
  const maxAge = Math.max(0, snapNumber("CREATIVE_SUITE_FATIGUE_MAX_AGE_DAYS", 45));
  if (f.impressions >= minImpr && f.ctr_baseline > 0 && f.ctr_recent <= f.ctr_baseline * (1 - dropPct)) {
    return { fatigued: true, reason: `CTR fell ${Math.round((1 - f.ctr_recent / f.ctr_baseline) * 100)}% below baseline` };
  }
  if (maxAge > 0 && f.age_days >= maxAge) return { fatigued: true, reason: `creative is ${f.age_days} days old` };
  return { fatigued: false, reason: "" };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 7) QUOTA — how many generations remain this period for a tier, given a running count.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function generationsRemaining(tier: SuiteTier, usedThisPeriod: number): number {
  const cap = creativeSuiteTierCaps(tier).monthly_generations;
  if (cap <= 0) return Number.POSITIVE_INFINITY;     // 0 = unlimited
  return Math.max(0, cap - Math.max(0, usedThisPeriod));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 8) DB BRIDGE — record creative outcomes as the SAME learning primitives the platform's self-improvement
//    loop already reads (OptimizationSignal + AgentLearningMemory), and load them back for the playbook.
//    Reuses existing tables — no schema change for the learning loop (CreativeAsset is the only new table,
//    and it just stores generated variants + their live performance).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Agent name the creative suite's lessons show up under in the oversight feed + learningInsights. */
export const CREATIVE_AGENT = "creative_suite_ai";

type Dbi = {
  create: (name: string, doc: Record<string, unknown>) => Promise<unknown>;
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
};

export interface RecordOutcomeInput {
  creative_id?: string;
  advertiser_id?: string | null;
  tier?: SuiteTier;
  format?: string;
  attributes?: Partial<Record<CreativeDimension, string>>;
  weight?: number;            // signed strength of the outcome (positive = good)
  impressions?: number;
  outcome?: string;           // e.g. "won", "lost", "clicked", "posted", "skipped"
  todayISO?: string;
}

/** Persist one creative outcome as learning signals. Best-effort; never throws into the caller. */
export async function recordCreativeOutcome(dbi: Dbi, o: RecordOutcomeInput): Promise<void> {
  const at = o.todayISO || "";
  const attrs = o.attributes || {};
  const weight = Number(o.weight) || 0;
  await dbi.create("OptimizationSignal", {
    kind: "creative_outcome",
    key: `creative:${o.format ?? "any"}`,
    advertiser_id: o.advertiser_id ?? null,
    tier: o.tier ?? null,
    creative_id: o.creative_id ?? null,
    attributes: attrs,
    outcome: o.outcome ?? null,
    weight,
    impressions: Math.max(0, Number(o.impressions) || 0),
    note: `creative ${o.outcome ?? "outcome"} (${o.format ?? "any"})`,
    created_at: at,
  }).catch(() => null);
  await dbi.create("AgentLearningMemory", {
    agent_name: CREATIVE_AGENT,
    type: "creative_outcome",
    target: `creative:${o.format ?? "any"}`,
    success: weight >= 0,
    provisional: true,
    improvement_notes: weight >= 0
      ? `A ${o.format ?? "creative"} with ${JSON.stringify(attrs)} performed well — favor these attributes.`
      : `A ${o.format ?? "creative"} with ${JSON.stringify(attrs)} underperformed — vary these attributes.`,
    attributes: attrs,
    recorded_at: at, created_at: at,
  }).catch(() => null);
}

/** Load recent creative outcomes as playbook input. Scope to one advertiser for their private playbook, or
 *  omit for the platform-wide playbook. Bounded read (recent N) — the learning loop only needs recency. */
export async function loadCreativeOutcomes(
  dbi: Dbi, advertiserId?: string | null, limit = 4000,
): Promise<CreativeOutcomeRow[]> {
  const q: Record<string, unknown> = { kind: "creative_outcome" };
  if (advertiserId) q.advertiser_id = advertiserId;
  const rows = await dbi.filter("OptimizationSignal", q, "-created_at", Math.max(1, limit)).catch(() => []) as Record<string, unknown>[];
  return (rows || []).map((r) => ({
    attributes: (r.attributes as Partial<Record<CreativeDimension, string>>) || {},
    weight: Number(r.weight) || 0,
    impressions: Math.max(0, Number(r.impressions) || 0),
  }));
}

/** Build an advertiser's (or the platform's) playbook straight from stored outcomes. */
export async function playbookFor(dbi: Dbi, advertiserId?: string | null, todayISO = ""): Promise<CreativePlaybook> {
  const rows = await loadCreativeOutcomes(dbi, advertiserId);
  return buildCreativePlaybook(rows, todayISO);
}
