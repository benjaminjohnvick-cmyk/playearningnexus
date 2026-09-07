// ad-targeting.ts — advertiser cohort targeting from first-party Know-Your-Customer (KYC) survey data.
//
// Every user completes the mandatory KYC ("welcome") survey (see kyc.ts); their answers live on
// User.kyc_answers (and a KYCResponse row). An advertiser may attach a `targeting` block to a creative to
// serve it only to users whose KYC answers match a chosen cohort (e.g. categories ∈ {Electronics, Gaming},
// shopping_style = "Deal hunter"). This module defines the cohort fields, validates advertiser input, and
// evaluates whether a given user matches — used by BOTH the interstitial ad selector and the social-media
// ad distribution (which posts to consenting members' accounts), so targeting behaves identically everywhere.
//
// Privacy posture: targeting uses only NON-IDENTIFYING cohort attributes the user themselves provided in the
// survey. It never targets an individual, and untargeted ads serve to everyone. Pure/deterministic.

import { snapBool } from "./settings.ts";

export const adTargetingEnabled = () => snapBool("AD_TARGETING_ENABLED", true);

// The cohort fields an advertiser can target. These mirror the KYC survey question ids (kyc.ts) so the
// advertiser UI and the matcher stay in lock-step. Adding a KYC question that should be targetable = add its
// id here.
export const TARGETING_FIELDS = [
  "goals",
  "categories",
  "game_genres",
  "shopping_budget",
  "shopping_style",
  "shopping_frequency",
  "device",
] as const;
export type TargetingField = typeof TARGETING_FIELDS[number];

export interface AdTargeting {
  enabled: boolean;
  match: "any" | "all"; // "any" = user matches if ANY chosen field matches; "all" = every chosen field must match
  criteria: Partial<Record<TargetingField, string[]>>;
}

/**
 * Normalize/validate an advertiser-supplied targeting object into a clean AdTargeting, or null when there is
 * no usable targeting (→ the ad is untargeted and serves to everyone). Accepts either
 * { criteria: { field: [...] } } or a flat { field: [...] } shape.
 */
export function normalizeTargeting(raw: unknown): AdTargeting | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const src = (r.criteria && typeof r.criteria === "object") ? r.criteria as Record<string, unknown> : r;
  const criteria: Partial<Record<TargetingField, string[]>> = {};
  for (const f of TARGETING_FIELDS) {
    const v = src[f];
    if (Array.isArray(v)) {
      const vals = Array.from(new Set(v.map((x) => String(x).slice(0, 120).trim()).filter(Boolean))).slice(0, 40);
      if (vals.length) criteria[f] = vals;
    }
  }
  if (!Object.keys(criteria).length) return null;
  return {
    enabled: r.enabled !== false,
    match: r.match === "all" ? "all" : "any",
    criteria,
  };
}

/** True if this ad carries an active, non-empty targeting cohort. */
export function isTargeted(targeting: AdTargeting | null | undefined): boolean {
  return !!(targeting && targeting.enabled !== false && targeting.criteria && Object.keys(targeting.criteria).length);
}

/**
 * Does a user's KYC answers satisfy an ad's targeting?
 * - Targeting globally OFF → everyone matches (feature disabled).
 * - Untargeted ad → everyone matches.
 * - Targeted ad + user with matching answers → matches per the "any"/"all" rule.
 * - Targeted ad + user with no / non-matching answers → does NOT match.
 * Case-insensitive; a single-value KYC answer is treated as a one-element list.
 */
export function userMatchesTargeting(
  targeting: AdTargeting | null | undefined,
  kycAnswers: Record<string, unknown> | null | undefined,
): boolean {
  if (!adTargetingEnabled()) return true;
  if (!isTargeted(targeting)) return true;
  const answers = kycAnswers || {};
  const t = targeting as AdTargeting;

  const fieldMatch = (field: TargetingField, wanted: string[]): boolean => {
    const a = answers[field];
    const have = Array.isArray(a) ? a.map((x) => String(x)) : (a != null && a !== "" ? [String(a)] : []);
    if (!have.length) return false;
    const haveSet = new Set(have.map((s) => s.toLowerCase()));
    return wanted.some((w) => haveSet.has(String(w).toLowerCase()));
  };

  const entries = Object.entries(t.criteria) as [TargetingField, string[]][];
  return t.match === "all"
    ? entries.every(([f, w]) => fieldMatch(f, w))
    : entries.some(([f, w]) => fieldMatch(f, w));
}

/** A short human-readable summary of a cohort, for advertiser UI / logs. */
export function targetingSummary(targeting: AdTargeting | null | undefined): string {
  if (!isTargeted(targeting)) return "Everyone (untargeted)";
  const t = targeting as AdTargeting;
  const parts = Object.entries(t.criteria).map(([f, w]) => `${f}: ${(w as string[]).join(" / ")}`);
  return `${t.match === "all" ? "Match ALL" : "Match ANY"} — ${parts.join("; ")}`;
}
