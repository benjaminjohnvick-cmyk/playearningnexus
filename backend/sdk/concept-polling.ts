// concept-polling.ts — the pure core of the Concept Polling loop: auto-generated video CONCEPTS are put in
// front of users as quick polls, and "which concept polls higher" becomes a learning signal that trains the
// SAME video playbook (sdk/video-engine.ts) — a cheap, pre-render preference signal alongside real engagement.
//
// Method: balanced MATCHUP sets (set size 2 = head-to-head "which is better?"; 3–5 = MaxDiff "pick best AND
// worst"). Best-worst counts roll up into a per-concept score in [-1, 1] (MaxDiff scaling), which is then
// mapped — via each concept's known video dimensions — into a signed playbook weight. Deterministic + testable.

import { snapBool, snapNumber } from "./settings.ts";

// ── deterministic PRNG (self-contained so tests are reproducible) ───────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── settings getters (numbers MUST be registered in settings.ts or snapNumber returns 0) ────────────────
export const conceptPollEnabled = () => snapBool("CONCEPT_POLL_ENABLED", true);
export const pollSetSize = () => Math.max(2, Math.min(5, Math.round(snapNumber("CONCEPT_POLL_SET_SIZE", 2))));
export const pollPoolSize = () => Math.max(2, Math.round(snapNumber("CONCEPT_POLL_POOL_SIZE", 24)));
export const pollTargetAppearances = () => Math.max(1, Math.round(snapNumber("CONCEPT_POLL_TARGET_APPEARANCES", 6)));
export const pollMinVotes = () => Math.max(1, Math.round(snapNumber("CONCEPT_POLL_MIN_VOTES", 30)));
export const pollLearnScale = () => Math.max(0, snapNumber("CONCEPT_POLL_LEARN_SCALE", 5));

// ── matchup building ────────────────────────────────────────────────────────────────────────────────────
export type Matchup = string[];   // a set of concept ids shown together

/** Build balanced matchup sets from a pool of concept ids. Each pass shuffles the pool and chunks it into
 *  non-overlapping sets of `setSize`, so every concept appears ~equally; run `targetAppearances` passes.
 *  No concept repeats within a set. Deterministic given `seed`. Pure. */
export function buildMatchups(
  conceptIds: string[],
  opts?: { setSize?: number; targetAppearances?: number; seed?: string | number },
): Matchup[] {
  const ids = Array.from(new Set((conceptIds || []).filter(Boolean)));
  const setSize = Math.max(2, Math.min(5, Math.floor(opts?.setSize ?? pollSetSize())));
  if (ids.length < setSize) return [];
  const passes = Math.max(1, Math.floor(opts?.targetAppearances ?? pollTargetAppearances()));
  const seedNum = typeof opts?.seed === "number" ? opts.seed : hashSeed(String(opts?.seed ?? "poll"));
  const rnd = mulberry32(seedNum);

  const sets: Matchup[] = [];
  const perPass = Math.floor(ids.length / setSize);
  for (let p = 0; p < passes; p++) {
    const deck = shuffled(ids, rnd);
    for (let i = 0; i < perPass; i++) {
      sets.push(deck.slice(i * setSize, i * setSize + setSize));
    }
  }
  return sets;
}

// ── vote normalization + tally ──────────────────────────────────────────────────────────────────────────
export interface RawVote { set: string[]; best?: string; worst?: string; }
export interface NormVote { set: string[]; best: string; worst?: string; }

/** Normalize a vote. For a head-to-head (set size 2), the loser is implicitly the "worst". Drops invalid
 *  votes (best not in set). Pure. */
export function normalizeVote(v: RawVote): NormVote | null {
  const set = Array.from(new Set((v.set || []).filter(Boolean)));
  if (set.length < 2 || !v.best || !set.includes(v.best)) return null;
  let worst = v.worst && set.includes(v.worst) && v.worst !== v.best ? v.worst : undefined;
  if (!worst && set.length === 2) worst = set.find((x) => x !== v.best);
  return { set, best: v.best, worst };
}

export interface ConceptTally { id: string; appearances: number; best: number; worst: number; score: number; }

/** Roll up best-worst votes into a per-concept MaxDiff score = (best − worst) / appearances, in [-1, 1].
 *  A concept chosen best every time → +1; chosen worst every time → −1; never distinguished → 0. Pure. */
export function tallyBestWorst(votes: RawVote[]): ConceptTally[] {
  const acc: Record<string, { appearances: number; best: number; worst: number }> = {};
  for (const raw of votes || []) {
    const v = normalizeVote(raw);
    if (!v) continue;
    for (const id of v.set) (acc[id] ??= { appearances: 0, best: 0, worst: 0 }).appearances++;
    (acc[v.best] ??= { appearances: 0, best: 0, worst: 0 }).best++;
    if (v.worst) (acc[v.worst] ??= { appearances: 0, best: 0, worst: 0 }).worst++;
  }
  return Object.entries(acc).map(([id, s]) => ({
    id, appearances: s.appearances, best: s.best, worst: s.worst,
    score: Math.round(((s.best - s.worst) / Math.max(1, s.appearances)) * 10000) / 10000,
  }));
}

/** Rank concepts best-first (score, then more appearances = more reliable). */
export function rankConcepts(tally: ConceptTally[]): ConceptTally[] {
  return tally.slice().sort((a, b) => (b.score - a.score) || (b.appearances - a.appearances));
}

/** Total normalized votes across a tally (each appearance counted once per concept, so /setSize gives votes). */
export function totalVotes(tally: ConceptTally[], setSize = 2): number {
  const appearances = tally.reduce((s, t) => s + t.appearances, 0);
  return Math.round(appearances / Math.max(2, setSize));
}

// ── map poll results into video-playbook learning signals ───────────────────────────────────────────────
export interface ConceptRef { id: string; attributes?: Record<string, string>; }

export interface PollLearningRow { concept_id: string; attributes: Record<string, string>; weight: number; impressions: number; }

/** Turn ranked poll results into signed learning rows for the video playbook: weight = (score − mean) × scale,
 *  centered on the poll mean so a concept is judged against its cohort; impressions = appearances (so a
 *  concept voted on more carries more weight through the playbook's sample-smoothing). Pure. */
export function pollLearningRows(
  tally: ConceptTally[], concepts: ConceptRef[], opts?: { scale?: number },
): PollLearningRow[] {
  if (!tally.length) return [];
  const scale = Math.max(0, opts?.scale ?? pollLearnScale());
  const mean = tally.reduce((s, t) => s + t.score, 0) / tally.length;
  const attrOf = new Map(concepts.map((c) => [c.id, c.attributes || {}]));
  const rows: PollLearningRow[] = [];
  for (const t of tally) {
    const attributes = attrOf.get(t.id);
    if (!attributes || !Object.keys(attributes).length) continue;
    rows.push({
      concept_id: t.id,
      attributes,
      weight: Math.round((t.score - mean) * scale * 10000) / 10000,
      impressions: t.appearances,
    });
  }
  return rows;
}
