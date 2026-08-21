// survey-suite.ts — the end-to-end AI Survey Suite: Pollfish-parity survey creation on the platform's own
// stack, unified with the self-learning + A/B machinery from the Creative Suite, in the platform's branding.
//
// Keeps every existing survey feature (PPCSurvey, generateAISurvey, insights, matching, UX learning) and adds:
// prompt→full survey generation, 19+ question types, paste-and-restructure, AI editing ops, survey logic
// (piping/quota/shuffle/branch), advanced methods (conjoint / MaxDiff / Van Westendorp / Gabor-Granger / A-B),
// a survey QUALITY + COMPLIANCE guard, a self-learning survey PLAYBOOK, a survey quality SCORE, translation,
// and AI reports. This module is the pure, deterministic, unit-tested core; the functions orchestrate the LLM.

import { snapBool, snapNumber } from "./settings.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 1) QUESTION-TYPE REGISTRY — 19+ types (Pollfish parity), each with a real spec.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type QCategory = "choice" | "scale" | "open" | "matrix" | "numeric" | "media" | "advanced";

export interface QuestionTypeSpec {
  key: string;
  label: string;
  category: QCategory;
  has_options: boolean;
  min_options?: number;
  max_options?: number;
  scale_points?: number;      // for scale types
  notes: string;
}

export const QUESTION_TYPES: QuestionTypeSpec[] = [
  { key: "single_select", label: "Single-select (radio)", category: "choice", has_options: true, min_options: 2, max_options: 10, notes: "Pick one." },
  { key: "multi_select", label: "Multi-select (checkbox)", category: "choice", has_options: true, min_options: 2, max_options: 15, notes: "Pick many; cap with a quota." },
  { key: "dropdown", label: "Dropdown", category: "choice", has_options: true, min_options: 3, notes: "Long option lists (e.g. country)." },
  { key: "yes_no", label: "Yes / No", category: "choice", has_options: true, min_options: 2, max_options: 2, notes: "Boolean." },
  { key: "rating_stars", label: "Star rating", category: "scale", has_options: false, scale_points: 5, notes: "1–5 (or configurable) stars." },
  { key: "rating_scale", label: "Numeric rating scale", category: "scale", has_options: false, scale_points: 10, notes: "1–N scale." },
  { key: "likert", label: "Likert agreement", category: "scale", has_options: true, min_options: 5, max_options: 7, notes: "Strongly disagree → strongly agree." },
  { key: "nps", label: "Net Promoter Score", category: "scale", has_options: false, scale_points: 11, notes: "0–10 recommend likelihood." },
  { key: "semantic_differential", label: "Semantic differential", category: "scale", has_options: false, scale_points: 7, notes: "Bipolar adjective scale." },
  { key: "slider", label: "Slider", category: "scale", has_options: false, notes: "Continuous value between min/max." },
  { key: "ranking", label: "Ranking / drag-order", category: "choice", has_options: true, min_options: 3, max_options: 8, notes: "Order items by preference." },
  { key: "matrix_single", label: "Matrix — single per row", category: "matrix", has_options: true, notes: "Rows × a shared scale." },
  { key: "matrix_multi", label: "Matrix — multi per row", category: "matrix", has_options: true, notes: "Grid of checkboxes." },
  { key: "constant_sum", label: "Constant sum (allocate 100)", category: "numeric", has_options: true, min_options: 2, notes: "Distribute points/%. " },
  { key: "numeric", label: "Numeric entry", category: "numeric", has_options: false, notes: "Number with optional min/max." },
  { key: "open_text", label: "Open-ended (short text)", category: "open", has_options: false, notes: "Free text; AI-coded in reports." },
  { key: "open_long", label: "Open-ended (paragraph)", category: "open", has_options: false, notes: "Long free text." },
  { key: "date", label: "Date / time", category: "numeric", has_options: false, notes: "Calendar picker." },
  { key: "image_choice", label: "Image choice", category: "media", has_options: true, min_options: 2, notes: "Pick from images." },
  { key: "star_grid", label: "Rating grid (matrix of stars)", category: "matrix", has_options: true, notes: "Rows each rated on stars." },
];

export const questionType = (key: string): QuestionTypeSpec | undefined => QUESTION_TYPES.find((q) => q.key === key);
export const allQuestionTypeKeys = (): string[] => QUESTION_TYPES.map((q) => q.key);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 2) ADVANCED-METHOD BLOCKS — structured question sets for research methodologies (Pollfish parity).
//    Each returns a "block": a method tag + the questions/config to insert into a survey.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type MethodKey = "ab_test" | "conjoint" | "maxdiff" | "van_westendorp" | "gabor_granger";

export interface MethodBlock { method: MethodKey; label: string; config: Record<string, unknown>; questions: Record<string, unknown>[]; notes: string; }

export const METHODS: { key: MethodKey; label: string; notes: string }[] = [
  { key: "ab_test", label: "A/B split test", notes: "Randomly show variant A or B of a stimulus and compare." },
  { key: "conjoint", label: "Conjoint analysis", notes: "Trade-off tasks to derive attribute part-worth utilities." },
  { key: "maxdiff", label: "MaxDiff (best–worst)", notes: "Pick most/least important across item sets." },
  { key: "van_westendorp", label: "Van Westendorp price sensitivity", notes: "4 price-perception questions → acceptable price range." },
  { key: "gabor_granger", label: "Gabor–Granger pricing", notes: "Purchase intent across a price ladder → demand curve." },
];

/** Build a Van Westendorp price-sensitivity block — the canonical 4 questions. */
export function vanWestendorpBlock(product: string): MethodBlock {
  const p = product || "this product";
  return {
    method: "van_westendorp", label: "Van Westendorp price sensitivity",
    config: { product: p, analysis: "PSM: intersection of cumulative curves → optimal price point + acceptable range" },
    questions: [
      { question_type: "numeric", stem: `At what price would ${p} be so expensive you would NOT consider buying it? (Too expensive)`, key: "too_expensive" },
      { question_type: "numeric", stem: `At what price would ${p} be getting expensive, but you'd still consider it? (Expensive/high side)`, key: "expensive" },
      { question_type: "numeric", stem: `At what price would ${p} be a bargain — a great buy for the money? (Cheap/good value)`, key: "cheap" },
      { question_type: "numeric", stem: `At what price would ${p} be so cheap you'd question its quality? (Too cheap)`, key: "too_cheap" },
    ],
    notes: "Standard 4-point Van Westendorp; analyze as a Price Sensitivity Meter.",
  };
}

/** Build a Gabor–Granger price-ladder block across the given price points. */
export function gaborGrangerBlock(product: string, prices: number[]): MethodBlock {
  const p = product || "this product";
  const ladder = (prices && prices.length ? prices : [5, 10, 15, 20, 25]).slice(0, 8);
  return {
    method: "gabor_granger", label: "Gabor–Granger pricing",
    config: { product: p, prices: ladder, analysis: "purchase-intent by price → demand curve + revenue-maximizing price" },
    questions: ladder.map((price) => ({
      question_type: "yes_no", stem: `Would you buy ${p} at $${price}?`, key: `gg_${price}`, price,
    })),
    notes: "Ask intent at each price (random or ascending); derive the demand curve.",
  };
}

/** Build a MaxDiff block: item sets shown best/worst. `setSize` items per screen. */
export function maxDiffBlock(items: string[], setSize = 4): MethodBlock {
  const its = (items || []).filter(Boolean);
  const size = Math.max(3, Math.min(5, setSize));
  return {
    method: "maxdiff", label: "MaxDiff (best–worst)",
    config: { items: its, set_size: size, analysis: "best–worst counts → preference share per item" },
    questions: [{ question_type: "maxdiff", stem: "Of these, which is MOST and which is LEAST important to you?", items: its, set_size: size }],
    notes: `Show ${size}-item sets; each item appears several times across sets.`,
  };
}

/** Build a simple conjoint task set over attributes → levels. */
export function conjointBlock(attributes: Record<string, string[]>): MethodBlock {
  const attrs = attributes || {};
  return {
    method: "conjoint", label: "Choice-based conjoint",
    config: { attributes: attrs, analysis: "hierarchical-bayes / counting → part-worth utilities + attribute importance" },
    questions: [{ question_type: "single_select", stem: "Which option would you choose?", conjoint_attributes: attrs, tasks: 8 }],
    notes: "Show profiles combining attribute levels; respondent picks a preferred profile per task.",
  };
}

/** Build an A/B split block: two stimulus variants, randomly assigned, same follow-up question. */
export function abTestBlock(variantA: string, variantB: string, followUp: string): MethodBlock {
  return {
    method: "ab_test", label: "A/B split test",
    config: { variant_a: variantA, variant_b: variantB, assignment: "random_5050", analysis: "compare follow-up metric across arms" },
    questions: [{ question_type: "single_select", stem: followUp || "How likely are you to buy?", ab_variants: [variantA, variantB] }],
    notes: "Half see A, half see B; compare the follow-up response between arms.",
  };
}

export function buildMethodBlock(method: MethodKey, input: Record<string, unknown>): MethodBlock | null {
  switch (method) {
    case "van_westendorp": return vanWestendorpBlock(String(input.product ?? ""));
    case "gabor_granger": return gaborGrangerBlock(String(input.product ?? ""), (input.prices as number[]) || []);
    case "maxdiff": return maxDiffBlock((input.items as string[]) || [], Number(input.set_size) || 4);
    case "conjoint": return conjointBlock((input.attributes as Record<string, string[]>) || {});
    case "ab_test": return abTestBlock(String(input.variant_a ?? "A"), String(input.variant_b ?? "B"), String(input.follow_up ?? ""));
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 3) QUALITY + COMPLIANCE GUARD — best-practice survey methodology checks PLUS the platform spine.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface QualityIssue { rule: string; match: string; severity: "block" | "warn" | "info"; hint: string; }

const LEADING = /\b(don't you (agree|think)|wouldn't you (say|agree)|isn't it true|surely you|as you know|obviously|clearly the)\b/i;
const LOADED = /\b(amazing|terrible|awful|excellent|horrible|fantastic|worst|best-in-class|revolutionary)\b/i;
const ABSOLUTE = /\b(always|never|every( |one|body)|all of the time|none of the time)\b/i;
const DOUBLE_BARRELED = /\b\w+ and \w+\b/i;   // heuristic; only a warn
// Platform compliance spine — never let survey copy make an earnings/return claim.
const COMPLIANCE_BLOCK = [
  /\bguarantee(?:d|s)?\b[^.?!]{0,40}\b(return|profit|income|earnings|roi|results?)\b/i,
  /\b\d+\s*x\b[^.?!]{0,20}\b(return|money|profit)\b|\b(double|triple)\s+your\s+money\b/i,
  /\b(risk[-\s]?free|guaranteed\s+(?:income|profit|earnings))\b/i,
  /\b(earn|make)\b[^.?!]{0,20}\$\s?\d[\d,]*[^.?!]{0,20}\b(guaranteed|per\s+day|a\s+day)\b/i,
];

/** Screen a single question stem for methodology quality + compliance. `ok` is false only on a BLOCK. */
export function screenQuestion(stem: string): { ok: boolean; issues: QualityIssue[] } {
  const s = String(stem ?? "");
  const issues: QualityIssue[] = [];
  for (const re of COMPLIANCE_BLOCK) {
    const m = s.match(re);
    if (m) issues.push({ rule: "compliance_claim", match: m[0].slice(0, 60), severity: "block", hint: "Survey copy must not promise earnings, returns, or ROI." });
  }
  let m: RegExpMatchArray | null;
  if ((m = s.match(LEADING))) issues.push({ rule: "leading_question", match: m[0], severity: "warn", hint: "Rephrase neutrally — leading wording biases answers." });
  if ((m = s.match(LOADED))) issues.push({ rule: "loaded_language", match: m[0], severity: "warn", hint: "Remove charged adjectives from the stem." });
  if ((m = s.match(ABSOLUTE))) issues.push({ rule: "absolute_terms", match: m[0], severity: "warn", hint: "Absolutes ('always'/'never') push respondents; soften them." });
  if (s.length > 220) issues.push({ rule: "too_long", match: `${s.length} chars`, severity: "info", hint: "Keep question stems short and scannable." });
  // double-barreled: an 'and'/'or' joining two askable ideas inside a question
  if (/\?/.test(s) && DOUBLE_BARRELED.test(s) && /\b(and|or)\b/i.test(s) && s.split(/\band\b|\bor\b/i).length > 1 && s.length > 60) {
    issues.push({ rule: "double_barreled", match: "asks two things at once", severity: "warn", hint: "Split into two questions — a respondent can't answer both at once." });
  }
  return { ok: !issues.some((i) => i.severity === "block"), issues };
}

/** Screen a whole survey (array of questions with `stem`/`question`). Returns aggregate issues + counts. */
export function screenSurvey(questions: Record<string, unknown>[]): { ok: boolean; issues: { index: number; issue: QualityIssue }[]; blocked: number } {
  const out: { index: number; issue: QualityIssue }[] = [];
  (questions || []).forEach((q, i) => {
    const stem = String(q.stem ?? q.question ?? "");
    for (const issue of screenQuestion(stem).issues) out.push({ index: i, issue });
  });
  const blocked = out.filter((o) => o.issue.severity === "block").length;
  return { ok: blocked === 0, issues: out, blocked };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 4) SURVEY QUALITY SCORE — 0–100 pre-flight, plus estimated completion time.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
const TIME_PER_TYPE: Record<string, number> = { open_text: 25, open_long: 45, matrix_single: 20, matrix_multi: 25, ranking: 20, constant_sum: 25, conjoint: 30, maxdiff: 25 };
export function estimatedSeconds(questions: Record<string, unknown>[]): number {
  return (questions || []).reduce((s, q) => s + (TIME_PER_TYPE[String(q.question_type)] ?? 10), 0);
}

export interface SurveyScore { score: number; est_seconds: number; type_diversity: number; issues: number; blocks: number; }

/** Score a survey 0–100: rewards a sensible length, question-type diversity, and few quality issues; a
 *  compliance block is a hard cap. Deterministic + unit-tested. */
export function scoreSurvey(questions: Record<string, unknown>[]): SurveyScore {
  const qs = questions || [];
  const n = qs.length;
  const screen = screenSurvey(qs);
  const est = estimatedSeconds(qs);
  const types = new Set(qs.map((q) => String(q.question_type))).size;

  let score = 60;
  if (n >= 3 && n <= 15) score += 12; else if (n > 20 || n < 2) score -= 15;   // length sweet spot
  if (types >= 3) score += 10; else if (types <= 1 && n > 3) score -= 8;         // diversity
  if (est <= 300) score += 8; else if (est > 600) score -= 12;                   // ≤5 min is ideal
  const warns = screen.issues.filter((i) => i.issue.severity === "warn").length;
  score -= Math.min(24, warns * 4);
  if (screen.blocked > 0) score = Math.min(score, 35);                           // can't ship
  return { score: Math.max(0, Math.min(100, Math.round(score))), est_seconds: est, type_diversity: types, issues: screen.issues.length, blocks: screen.blocked };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 5) EDIT OPERATIONS — the deterministic ones run in code; the language ones (reword/expand/tone/translate)
//    are performed by the function via the LLM. This registry is the menu the UI shows.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const EDIT_OPS = [
  { key: "reword", label: "Reword", ai: true }, { key: "expand", label: "Expand / add detail", ai: true },
  { key: "shorten", label: "Shorten", ai: true }, { key: "change_tone", label: "Change tone", ai: true },
  { key: "spellcheck", label: "Spell-check & fix grammar", ai: true }, { key: "translate", label: "Translate", ai: true },
  { key: "add_option", label: "Add answer option", ai: false }, { key: "remove_option", label: "Remove option", ai: false },
  { key: "shuffle_options", label: "Shuffle options", ai: false }, { key: "add_neutral", label: "Add neutral / 'Prefer not to say'", ai: false },
  { key: "change_type", label: "Change question type", ai: false }, { key: "undo", label: "Undo last change", ai: false },
] as const;

/** Deterministically shuffle options using a seed (no Math.random — keeps it testable/replayable). */
export function shuffleOptions(options: string[], seed = 1): string[] {
  const a = [...(options || [])];
  let s = (seed || 1) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;     // LCG
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function addNeutralOption(options: string[], label = "Prefer not to say"): string[] {
  const a = [...(options || [])];
  if (!a.some((o) => String(o).toLowerCase().includes("prefer not"))) a.push(label);
  return a;
}

// Common localization targets (Pollfish 160+ countries; these are the offer list).
export const LOCALES = ["en", "es", "fr", "de", "pt", "it", "nl", "pl", "ja", "ko", "zh", "ar", "hi", "ru", "tr", "id", "vi", "th"];

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 6) SELF-LEARNING SURVEY PLAYBOOK — learn which question choices drive completion + response quality,
//    reusing the platform's OptimizationSignal + AgentLearningMemory loop (no new learning tables).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const SURVEY_DIMENSIONS = ["question_type", "position", "length", "scale_points", "has_neutral", "tone", "topic"] as const;
export type SurveyDimension = typeof SURVEY_DIMENSIONS[number];

export interface SAttrStat { value: string; wins: number; observations: number; score: number; }
export interface SDimRanking { dimension: SurveyDimension; ranked: SAttrStat[]; }
export interface SurveyPlaybook { dimensions: SDimRanking[]; sample_size: number; updated_at: string; top: Record<string, string>; }
export interface SurveyOutcomeRow { attributes?: Partial<Record<SurveyDimension, string>>; weight?: number; observations?: number; }

function smoothed(wins: number, obs: number): number { return wins / (Math.max(0, obs) + 2); }

export function buildSurveyPlaybook(rows: SurveyOutcomeRow[], todayISO = ""): SurveyPlaybook {
  const acc: Record<string, Record<string, { wins: number; obs: number }>> = {};
  let sample = 0;
  for (const r of rows || []) {
    const wt = Number(r.weight) || 0, obs = Math.max(1, Number(r.observations) || 1);
    const attrs = r.attributes || {}; let counted = false;
    for (const dim of SURVEY_DIMENSIONS) {
      const v = attrs[dim]; if (!v) continue; counted = true;
      (acc[dim] ??= {}); (acc[dim][v] ??= { wins: 0, obs: 0 });
      acc[dim][v].wins += wt; acc[dim][v].obs += obs;
    }
    if (counted) sample++;
  }
  const dimensions: SDimRanking[] = []; const top: Record<string, string> = {};
  for (const dim of SURVEY_DIMENSIONS) {
    const vals = acc[dim]; if (!vals) continue;
    const ranked = Object.entries(vals).map(([value, s]) => ({
      value, wins: Math.round(s.wins * 100) / 100, observations: s.obs, score: Math.round(smoothed(s.wins, s.obs) * 10000) / 10000,
    })).sort((a, b) => b.score - a.score);
    dimensions.push({ dimension: dim, ranked });
    if (ranked.length && ranked[0].score > 0) top[dim] = ranked[0].value;
  }
  return { dimensions, sample_size: sample, updated_at: todayISO, top };
}

export function surveyRecommendations(pb: SurveyPlaybook, limit = 6): string[] {
  const recs: string[] = [];
  for (const d of pb.dimensions) {
    const best = d.ranked[0], worst = d.ranked[d.ranked.length - 1];
    if (best && best.score > 0) recs.push(`Favor ${d.dimension.replace("_", " ")} = "${best.value}" — best completion/quality so far.`);
    if (worst && worst.score < 0 && worst.value !== best?.value) recs.push(`Ease off ${d.dimension.replace("_", " ")} = "${worst.value}" — it drags completion.`);
  }
  if (!recs.length) recs.push("Not enough response data yet — field a survey to start the learning loop.");
  return recs.slice(0, limit);
}

// ── Config / tier gating (lightweight) ──────────────────────────────────────────────────────────────
export const surveySuiteEnabled = () => snapBool("SURVEY_SUITE_ENABLED", true);
export const surveyMaxQuestions = () => Math.max(1, snapNumber("SURVEY_SUITE_MAX_QUESTIONS", 30));
export const surveyMethodsEnabled = () => snapBool("SURVEY_SUITE_METHODS_ENABLED", true);
export const surveyTranslationEnabled = () => snapBool("SURVEY_SUITE_TRANSLATION_ENABLED", true);
export const surveyConversationalEnabled = () => snapBool("SURVEY_SUITE_CONVERSATIONAL_ENABLED", true);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 7) DB BRIDGE — record survey outcomes as learning signals; load them for the playbook.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const SURVEY_AGENT = "survey_suite_ai";
type Dbi = {
  create: (n: string, d: Record<string, unknown>) => Promise<unknown>;
  filter: (n: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
};

export interface RecordSurveyOutcomeInput {
  survey_id?: string; advertiser_id?: string | null;
  attributes?: Partial<Record<SurveyDimension, string>>;
  weight?: number; observations?: number; outcome?: string; todayISO?: string;
}
export async function recordSurveyOutcome(dbi: Dbi, o: RecordSurveyOutcomeInput): Promise<void> {
  const at = o.todayISO || ""; const attrs = o.attributes || {}; const weight = Number(o.weight) || 0;
  await dbi.create("OptimizationSignal", {
    kind: "survey_outcome", key: `survey:${Object.values(attrs)[0] ?? "any"}`,
    advertiser_id: o.advertiser_id ?? null, survey_id: o.survey_id ?? null,
    attributes: attrs, outcome: o.outcome ?? null, weight, observations: Math.max(0, Number(o.observations) || 0),
    note: `survey ${o.outcome ?? "outcome"}`, created_at: at,
  }).catch(() => null);
  await dbi.create("AgentLearningMemory", {
    agent_name: SURVEY_AGENT, type: "survey_outcome", target: `survey:${Object.values(attrs)[0] ?? "any"}`,
    success: weight >= 0, provisional: true,
    improvement_notes: weight >= 0 ? `Survey attributes ${JSON.stringify(attrs)} completed well — favor them.` : `Survey attributes ${JSON.stringify(attrs)} hurt completion — vary them.`,
    attributes: attrs, recorded_at: at, created_at: at,
  }).catch(() => null);
}

export async function loadSurveyOutcomes(dbi: Dbi, advertiserId?: string | null, limit = 4000): Promise<SurveyOutcomeRow[]> {
  const q: Record<string, unknown> = { kind: "survey_outcome" };
  if (advertiserId) q.advertiser_id = advertiserId;
  const rows = await dbi.filter("OptimizationSignal", q, "-created_at", Math.max(1, limit)).catch(() => []) as Record<string, unknown>[];
  return (rows || []).map((r) => ({ attributes: (r.attributes as Partial<Record<SurveyDimension, string>>) || {}, weight: Number(r.weight) || 0, observations: Math.max(0, Number(r.observations) || 0) }));
}
export async function surveyPlaybookFor(dbi: Dbi, advertiserId?: string | null, todayISO = ""): Promise<SurveyPlaybook> {
  return buildSurveyPlaybook(await loadSurveyOutcomes(dbi, advertiserId), todayISO);
}
