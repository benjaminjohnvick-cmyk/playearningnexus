// ad-targeting-ai.ts — the self-learning, self-improving layer over ad cohort targeting.
//
// Posture (matches the platform's other AI functions, see autonomy-kernel.ts / optimizer.ts):
//   • Graduated autonomy: suggest → assist → auto, admin-capped (AD_TARGETING_AI_AUTONOMY).
//   • A permanent gate: the AI may bias RELEVANCE (ranking) freely, but it NEVER changes an advertiser's
//     chosen targeting, never targets an individual, and never introduces sensitive/protected attributes —
//     it only reweights the same non-sensitive, first-party KYC cohorts. Changing an advertiser's contracted
//     targeting stays a human/assist action (a proposal), never an automatic one.
//   • A kill switch (AD_TARGETING_AI_KILL) and an enable flag; when off/killed every function no-ops so the
//     system falls back to plain cohort matching.
//
// What it learns: from observed engagement (a user answered a PPC creative and marked "interested", an
// interstitial completed, etc.), which creatives resonate with which cohorts. It stores a smoothed model and
// uses it to (a) ORDER matching creatives by learned affinity for the current user's cohort, and (b) RECOMMEND
// cohort refinements to advertisers (advisory unless a human applies them). Pure/deterministic core — tested.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export const aiTargetingEnabled = () => snapBool("AD_TARGETING_AI_ENABLED", true);
export const aiTargetingKill = () => snapBool("AD_TARGETING_AI_KILL", false);
export const aiTargetingAutonomy = () => {
  const v = snapString("AD_TARGETING_AI_AUTONOMY", "assist").toLowerCase();
  return (v === "suggest" || v === "assist" || v === "auto") ? v : "assist";
};
export const aiTargetingMinSample = () => Math.max(1, snapNumber("AD_TARGETING_AI_MIN_SAMPLE", 30));
export const aiTargetingPriorRate = () => Math.min(1, Math.max(0, snapNumber("AD_TARGETING_AI_PRIOR", 0.1)));
export const aiTargetingPriorWeight = () => Math.max(1, snapNumber("AD_TARGETING_AI_PRIOR_WEIGHT", 20));

/** True when the AI layer is allowed to act at all (enabled AND not killed). */
export const aiTargetingActive = () => aiTargetingEnabled() && !aiTargetingKill();

// ── Model shapes ────────────────────────────────────────────────────────────────────────────────────
export interface CreativeStat { impressions: number; engagements: number; score: number; cohort: Record<string, Record<string, { impressions: number; engagements: number; score: number }>>; }
export interface TargetingModel {
  version: number;
  updated_at: string;
  events: number;
  creatives: Record<string, CreativeStat>;   // ad_id → stats
  cohort_global: Record<string, Record<string, { impressions: number; engagements: number; score: number }>>; // field → value → rate across all creatives
}

/** Beta/sample-smoothed engagement rate: pulls sparse observations toward the prior so a 1-of-1 fluke can't
 *  outrank a proven cohort. Deterministic. */
export function smoothedRate(engagements: number, impressions: number, priorRate = aiTargetingPriorRate(), priorWeight = aiTargetingPriorWeight()): number {
  const e = Math.max(0, engagements), n = Math.max(0, impressions);
  return (e + priorRate * priorWeight) / (n + priorWeight);
}

export interface LearnEvent { ad_id: string; cohort: Record<string, string[]>; engaged: boolean; }

/** Build the learned model from raw engagement events (one per creative view with the viewer's cohort). */
export function buildModelFromEvents(events: LearnEvent[], opts?: { priorRate?: number; priorWeight?: number }): TargetingModel {
  const pr = opts?.priorRate ?? aiTargetingPriorRate();
  const pw = opts?.priorWeight ?? aiTargetingPriorWeight();
  const creatives: Record<string, CreativeStat> = {};
  const cohortGlobal: Record<string, Record<string, { impressions: number; engagements: number; score: number }>> = {};

  for (const ev of (events || [])) {
    if (!ev || !ev.ad_id) continue;
    const eng = ev.engaged ? 1 : 0;
    const c = (creatives[ev.ad_id] ||= { impressions: 0, engagements: 0, score: 0, cohort: {} });
    c.impressions++; c.engagements += eng;
    for (const [field, values] of Object.entries(ev.cohort || {})) {
      for (const value of (values || [])) {
        const v = String(value);
        const cc = (c.cohort[field] ||= {}); const cv = (cc[v] ||= { impressions: 0, engagements: 0, score: 0 });
        cv.impressions++; cv.engagements += eng;
        const gf = (cohortGlobal[field] ||= {}); const gv = (gf[v] ||= { impressions: 0, engagements: 0, score: 0 });
        gv.impressions++; gv.engagements += eng;
      }
    }
  }
  // Finalize smoothed scores.
  for (const c of Object.values(creatives)) {
    c.score = smoothedRate(c.engagements, c.impressions, pr, pw);
    for (const byVal of Object.values(c.cohort)) for (const cv of Object.values(byVal)) cv.score = smoothedRate(cv.engagements, cv.impressions, pr, pw);
  }
  for (const byVal of Object.values(cohortGlobal)) for (const gv of Object.values(byVal)) gv.score = smoothedRate(gv.engagements, gv.impressions, pr, pw);

  return { version: 1, updated_at: new Date().toISOString(), events: (events || []).length, creatives, cohort_global: cohortGlobal };
}

/** A creative's learned affinity for a specific user's cohort: blend the creative's overall score with the
 *  creative's rates for the user's own cohort values. Falls back to the creative's base score, then neutral. */
export function affinityForUser(adId: string, model: TargetingModel | null | undefined, kycAnswers: Record<string, unknown> | null | undefined): number {
  if (!model || !model.creatives) return 0.5;
  const c = model.creatives[String(adId)];
  if (!c) return 0.5;                       // unseen creative → neutral (gets explored)
  const answers = kycAnswers || {};
  const rates: number[] = [];
  for (const [field, byVal] of Object.entries(c.cohort || {})) {
    const a = answers[field];
    const have = Array.isArray(a) ? a.map(String) : (a != null && a !== "" ? [String(a)] : []);
    for (const v of have) { const cv = byVal[v]; if (cv && cv.impressions > 0) rates.push(cv.score); }
  }
  const cohortAffinity = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : c.score;
  // Blend: 60% user-cohort-specific, 40% the creative's overall pull.
  return 0.6 * cohortAffinity + 0.4 * c.score;
}

/** Order creatives by learned affinity for this user (DESC), stable for ties. A RELEVANCE bias only — it
 *  never drops a creative. No-ops (returns input unchanged) when the AI layer is off/killed or the model is
 *  empty, so plain cohort matching still governs which ads are eligible. */
export function rankByLearnedAffinity<T extends Record<string, unknown>>(creatives: T[], model: TargetingModel | null | undefined, kycAnswers: Record<string, unknown> | null | undefined): T[] {
  if (!aiTargetingActive() || !model || !model.creatives || !Object.keys(model.creatives).length) return creatives || [];
  const arr = (creatives || []).map((c, i) => ({ c, i, a: affinityForUser(String(c.id ?? c.ad_id ?? ""), model, kycAnswers) }));
  arr.sort((x, y) => (y.a - x.a) || (x.i - y.i));   // affinity desc, original order for ties
  return arr.map((x) => x.c);
}

/** Recommend the top cohort values for a creative (advisory — for advertiser suggestions / admin status).
 *  Only returns values that clear the min-sample bar so we don't advise on noise. */
export function recommendCohortsForCreative(adId: string, model: TargetingModel | null | undefined, opts?: { perField?: number; minSample?: number }): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const c = model?.creatives?.[String(adId)];
  if (!c) return out;
  const perField = Math.max(1, opts?.perField ?? 3);
  const minSample = Math.max(1, opts?.minSample ?? aiTargetingMinSample());
  for (const [field, byVal] of Object.entries(c.cohort || {})) {
    const ranked = Object.entries(byVal)
      .filter(([, s]) => s.impressions >= minSample)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, perField)
      .map(([v]) => v);
    if (ranked.length) out[field] = ranked;
  }
  return out;
}

/** Load the persisted learned model singleton (or null when absent / AI layer off / killed). */
// deno-lint-ignore no-explicit-any
export async function loadTargetingModel(db: any): Promise<TargetingModel | null> {
  if (!aiTargetingActive()) return null;
  try {
    const rows = await db.filter("AdTargetingModel", { singleton: "ad_targeting" }, "-created_date", 1);
    const row = (rows || [])[0];
    return (row && row.model) ? row.model as TargetingModel : null;
  } catch { return null; }
}

/** Compact model summary for the admin status endpoint. */
export function summarizeModel(model: TargetingModel | null | undefined): Record<string, unknown> {
  if (!model) return { present: false };
  const creatives = Object.keys(model.creatives || {}).length;
  const topGlobal: Record<string, string[]> = {};
  for (const [field, byVal] of Object.entries(model.cohort_global || {})) {
    topGlobal[field] = Object.entries(byVal).filter(([, s]) => s.impressions >= aiTargetingMinSample()).sort((a, b) => b[1].score - a[1].score).slice(0, 3).map(([v]) => v);
  }
  return { present: true, version: model.version, updated_at: model.updated_at, events: model.events, creatives, top_cohorts: topGlobal };
}
