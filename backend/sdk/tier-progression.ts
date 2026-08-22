// tier-progression.ts — the advertiser tier-progression engine: one-tap renewal, and opt-in auto-advance up
// the ladder (Tier 1 → Tier 2 → Tier 3) over up to five years, driven by MEASURED results.
//
// LADDER (admin-tunable): Tier 1 + Tier 2 combined up to 2 years, then Tier 3 up to 3 years — 5 years total.
//
// COMPLIANCE SPINE (unchanged all-session):
//   • "Going well" and the ROI/ROAS thresholds are MEASURED from advertiser-metrics (real platform data). The
//     engine reacts to measured results; it never GUARANTEES an ROI.
//   • Same-tier RENEWAL is a one-tap "see your results → Agree" (with an advance renewal notice), not a silent
//     charge. AUTO-ADVANCE to a higher-priced tier is an EXPLICIT opt-in shown at signup (price + threshold
//     disclosed) with a pre-charge notice before each advance — it ships OFF by default (negative-option-billing
//     safety). This module tracks state only; it never moves money.
//
// Pure/deterministic so it can be unit-tested offline; `todayISO` is always passed in.

import { snapBool, snapNumber } from "./settings.ts";

export type Tier = "tier1" | "tier2" | "tier3";
export const TIER_ORDER: Tier[] = ["tier1", "tier2", "tier3"];
export const normalizeTier = (t: unknown): Tier => (t === "tier3" || t === "tier2") ? t : "tier1";
export function nextTier(t: Tier): Tier | null { const i = TIER_ORDER.indexOf(t); return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null; }

// ── Ladder config ─────────────────────────────────────────────────────────────────────────────────────
export const progressionEnabled = () => snapBool("TIER_PROGRESSION_ENABLED", true);
export const maxTotalYears = () => Math.max(1, snapNumber("TIER_MAX_TOTAL_YEARS", 5));
/** Combined cap on years spent across Tier 1 AND Tier 2. */
export const tier12MaxYears = () => Math.max(1, snapNumber("TIER12_MAX_YEARS", 2));
/** Cap on years at Tier 3. */
export const tier3MaxYears = () => Math.max(1, snapNumber("TIER3_MAX_YEARS", 3));

// ── "Going well" thresholds (measured) ────────────────────────────────────────────────────────────────
/** Minimum MEASURED ROAS for a renewal to be offered as "going well". */
export const renewalRoasBaseline = () => Math.max(0, snapNumber("TIER_RENEWAL_ROAS_BASELINE", 1.0));
/** Minimum delivered fraction of guaranteed advertising for "on track". */
export const renewalDeliveryPct = () => Math.min(1, Math.max(0, snapNumber("TIER_RENEWAL_DELIVERY_PCT", 0.85)));

// ── Auto-advance opt-in ───────────────────────────────────────────────────────────────────────────────
/** Whether auto-advance is opt-IN by default at signup. Ships FALSE: auto-charging a higher-priced tier by
 *  default is a negative-option-billing risk; flip on only with counsel sign-off. */
export const autoAdvanceDefaultOptIn = () => snapBool("TIER_AUTOADVANCE_DEFAULT_OPT_IN", false);
/** Default measured-ROI threshold (as ROAS, revenue/spend) an advertiser must reach to auto-advance. */
export const autoAdvanceDefaultRoas = () => Math.max(0, snapNumber("TIER_AUTOADVANCE_DEFAULT_ROAS", 2.0));
/** Days of advance notice before a renewal OR an auto-advance charge (auto-renewal law + click-to-cancel). */
export const progressionNoticeDays = () => Math.max(0, snapNumber("TIER_PROGRESSION_NOTICE_DAYS", 30));

// ── Years accounting ────────────────────────────────────────────────────────────────────────────────────
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export interface YearsAccounting {
  years_at_current: number;       // whole years at the current tier
  tier12_years_used: number;      // cumulative years across tier1 + tier2
  tier3_years_used: number;       // years at tier3
  total_years_used: number;       // cumulative across all tiers
  tier12_years_left: number;      // remaining under the tier1+2 cap
  tier3_years_left: number;       // remaining under the tier3 cap
  total_years_left: number;       // remaining under the 5-year cap
}

/** Compute the years picture from a record's timeline fields. `tier12_years` / `tier3_years` accumulate as the
 *  advertiser renews/advances; `tier_started_at` bounds the current tier. Pure. */
export function yearsAccounting(rec: Record<string, unknown>, todayISO: string): YearsAccounting {
  const current = normalizeTier(rec.current_tier ?? rec.tier);
  const startISO = String(rec.tier_started_at ?? rec.purchased_at ?? rec.created_date ?? "");
  let yearsAtCurrent = 0;
  const start = Date.parse(startISO), today = Date.parse(todayISO);
  if (!isNaN(start) && !isNaN(today) && today > start) yearsAtCurrent = Math.floor((today - start) / YEAR_MS);

  const tier12Prior = Math.max(0, Number(rec.tier12_years) || 0);
  const tier3Prior = Math.max(0, Number(rec.tier3_years) || 0);
  const inT12 = current === "tier1" || current === "tier2";
  const tier12Used = tier12Prior + (inT12 ? yearsAtCurrent : 0);
  const tier3Used = tier3Prior + (current === "tier3" ? yearsAtCurrent : 0);
  const totalUsed = tier12Used + tier3Used;

  return {
    years_at_current: yearsAtCurrent,
    tier12_years_used: tier12Used, tier3_years_used: tier3Used, total_years_used: totalUsed,
    tier12_years_left: Math.max(0, tier12MaxYears() - tier12Used),
    tier3_years_left: Math.max(0, tier3MaxYears() - tier3Used),
    total_years_left: Math.max(0, maxTotalYears() - totalUsed),
  };
}

// ── Decisions ───────────────────────────────────────────────────────────────────────────────────────────
export interface ProgressionResults { roas: number; roi_pct: number; delivered_pct: number; substantiated: boolean; going_well: boolean; }

/** Is the advertiser "going well" enough to offer a renewal? MEASURED: ROAS ≥ baseline AND delivery on track.
 *  If not substantiated yet, we don't claim it's going well (but renewal can still be offered honestly as
 *  "results pending"). Pure. */
export function evaluateResults(m: { roas?: number; roi_pct?: number; delivered_pct?: number; substantiated?: boolean }): ProgressionResults {
  const roas = Number(m.roas) || 0;
  const delivered = Math.min(1, Math.max(0, Number(m.delivered_pct) || 0));
  const substantiated = !!m.substantiated;
  const goingWell = substantiated && roas >= renewalRoasBaseline() && delivered >= renewalDeliveryPct();
  return { roas, roi_pct: Number(m.roi_pct) || 0, delivered_pct: delivered, substantiated, going_well: goingWell };
}

/** Can this advertiser RENEW the same tier for another year? Requires headroom under the applicable cap. */
export function renewalEligible(rec: Record<string, unknown>, acc: YearsAccounting): boolean {
  if (acc.total_years_left <= 0) return false;
  const current = normalizeTier(rec.current_tier ?? rec.tier);
  if (current === "tier3") return acc.tier3_years_left > 0;
  return acc.tier12_years_left > 0;   // tier1/tier2 share the combined cap
}

/** Is the advertiser eligible to AUTO-ADVANCE to the next tier? Requires: opted in, a next tier exists, headroom
 *  under the caps, AND measured ROAS ≥ their chosen threshold. Measured — never a promise. */
export function advanceEligible(rec: Record<string, unknown>, results: ProgressionResults, acc: YearsAccounting): { eligible: boolean; to: Tier | null; reason: string } {
  const current = normalizeTier(rec.current_tier ?? rec.tier);
  const to = nextTier(current);
  if (!to) return { eligible: false, to: null, reason: "already at the top tier" };
  // Opted in when: explicitly true, OR the field is unset AND the platform default opt-in is on. An explicit
  // false (the advertiser opted OUT) is always honored.
  const optedIn = rec.auto_advance_opt_in === true || (rec.auto_advance_opt_in !== false && autoAdvanceDefaultOptIn());
  if (!optedIn) return { eligible: false, to, reason: "opted out of auto-advance" };
  if (acc.total_years_left <= 0) return { eligible: false, to, reason: "5-year cap reached" };
  if (to === "tier2" && acc.tier12_years_left <= 0) return { eligible: false, to, reason: "tier1+2 year cap reached" };
  if (to === "tier3" && acc.tier3_years_left <= 0) return { eligible: false, to, reason: "tier3 year cap reached" };
  const threshold = Math.max(0, Number(rec.auto_advance_roas) || autoAdvanceDefaultRoas());
  if (!results.substantiated) return { eligible: false, to, reason: "results not yet substantiated" };
  if (results.roas < threshold) return { eligible: false, to, reason: `measured ROAS ${results.roas} below threshold ${threshold}` };
  return { eligible: true, to, reason: `measured ROAS ${results.roas} ≥ threshold ${threshold}` };
}

export interface ProgressionDecision {
  tier: Tier;
  at_term_boundary: boolean;
  results: ProgressionResults;
  years: YearsAccounting;
  can_renew: boolean;
  advance: { eligible: boolean; to: Tier | null; reason: string };
  recommended: "renew" | "advance" | "complete" | "hold";
  notice_days: number;
}

/** The full decision for one advertiser at (or approaching) a term boundary — drives the "see your results →
 *  Agree" screen and the scheduled sweep. `atTermBoundary` is passed by the caller (term end within notice
 *  window). Pure. */
export function progressionDecision(rec: Record<string, unknown>, metrics: { roas?: number; roi_pct?: number; delivered_pct?: number; substantiated?: boolean }, todayISO: string, atTermBoundary: boolean): ProgressionDecision {
  const tier = normalizeTier(rec.current_tier ?? rec.tier);
  const acc = yearsAccounting(rec, todayISO);
  const results = evaluateResults(metrics);
  const canRenew = renewalEligible(rec, acc);
  const adv = advanceEligible(rec, results, acc);

  let recommended: ProgressionDecision["recommended"] = "hold";
  if (atTermBoundary) {
    if (adv.eligible) recommended = "advance";
    else if (canRenew) recommended = "renew";
    else recommended = "complete";   // caps reached / cannot continue
  }
  return { tier, at_term_boundary: atTermBoundary, results, years: acc, can_renew: canRenew, advance: adv, recommended, notice_days: progressionNoticeDays() };
}

// ── Applying a transition to a record (returns the patch; caller persists; caller handles billing) ─────────

/** The record patch for a same-tier renewal (adds a year to the applicable cumulative counter, restarts the
 *  term clock). Does NOT move money — the caller charges via the normal billing path after the notice. */
export function renewalPatch(rec: Record<string, unknown>, todayISO: string): Record<string, unknown> {
  const current = normalizeTier(rec.current_tier ?? rec.tier);
  const patch: Record<string, unknown> = { tier_started_at: todayISO, last_renewed_at: todayISO, renewals: (Number(rec.renewals) || 0) + 1 };
  if (current === "tier3") patch.tier3_years = (Number(rec.tier3_years) || 0) + 1;
  else patch.tier12_years = (Number(rec.tier12_years) || 0) + 1;
  return patch;
}

/** The record patch for advancing to the next tier (banks the completed years into the cumulative counters and
 *  starts the new tier's clock). Does NOT move money. Returns null if there is no next tier / no headroom. */
export function advancePatch(rec: Record<string, unknown>, todayISO: string): { patch: Record<string, unknown>; to: Tier } | null {
  const current = normalizeTier(rec.current_tier ?? rec.tier);
  const to = nextTier(current);
  if (!to) return null;
  const acc = yearsAccounting(rec, todayISO);
  const patch: Record<string, unknown> = {
    current_tier: to, tier_started_at: todayISO, advanced_at: todayISO,
    // bank the years spent at the tier we're leaving
    tier12_years: acc.tier12_years_used, tier3_years: acc.tier3_years_used,
    advances: (Number(rec.advances) || 0) + 1,
  };
  return { patch, to };
}
