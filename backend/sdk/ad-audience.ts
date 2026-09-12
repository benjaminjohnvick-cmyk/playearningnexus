// ad-audience.ts — DEMOGRAPHIC targeting + NEW-vs-EXISTING audience targeting/optimization, layered on top of
// the interest/behavior cohort targeting in ad-targeting.ts.
//
// Two new dimensions an advertiser can target AND optimize for:
//   1. Demographics — age_range, gender, country, region — matched against the user's own profile demographics
//      (User.demographics / top-level / kyc_answers). Non-identifying cohort attributes only, same privacy
//      posture as the interest cohorts: never targets an individual; an untargeted ad still serves to everyone.
//   2. Audience type — "new" vs "existing" users — derived cheaply from account age (and a has_purchased flag
//      when present), so an advertiser can chase acquisition (new) or retention/repeat (existing), or both.
//
// Pure/deterministic (no DB reads) so it's safe on the hot ad-serving path and unit-testable. The AI optimizer
// (ad-metrics-optimizer.ts) reads the same helpers to break performance down by cohort and bias delivery.
import { snapBool, snapNumber } from "./settings.ts";

export const demographicTargetingEnabled = () => snapBool("AD_DEMOGRAPHIC_TARGETING_ENABLED", true);
/** An account younger than this many days is treated as a "new" user for audience targeting/optimization. */
export const newUserMaxDays = () => Math.max(1, snapNumber("AD_NEW_USER_MAX_DAYS", 30));

export const DEMOGRAPHIC_FIELDS = ["age_range", "gender", "country", "region"] as const;
export type DemographicField = typeof DEMOGRAPHIC_FIELDS[number];

export const AUDIENCE_TYPES = ["all", "new", "existing"] as const;
export type AudienceType = typeof AUDIENCE_TYPES[number];

/** What an advertiser optimizes their delivery toward. "roas" is the default health objective; the audience
 *  objectives bias delivery toward acquiring new users or deepening existing ones. */
export const OPTIMIZE_OBJECTIVES = ["roas", "new_users", "existing_users"] as const;
export type OptimizeObjective = typeof OPTIMIZE_OBJECTIVES[number];

export interface AudienceTargeting {
  demographics: Partial<Record<DemographicField, string[]>>;
  audience_type: AudienceType;
}

/** Pull a user's demographic attributes from wherever they live, defensively. Returns lowercased strings. */
export function userDemographics(user: Record<string, unknown> | null | undefined): Partial<Record<DemographicField, string>> {
  const u = user || {};
  const demo = (u.demographics && typeof u.demographics === "object") ? u.demographics as Record<string, unknown> : {};
  const kyc = (u.kyc_answers && typeof u.kyc_answers === "object") ? u.kyc_answers as Record<string, unknown> : {};
  const pick = (f: DemographicField): string | undefined => {
    const v = demo[f] ?? (u as Record<string, unknown>)[f] ?? kyc[f];
    return v != null && v !== "" ? String(v).toLowerCase() : undefined;
  };
  const out: Partial<Record<DemographicField, string>> = {};
  for (const f of DEMOGRAPHIC_FIELDS) { const v = pick(f); if (v) out[f] = v; }
  return out;
}

/** Classify a user as "new" or "existing". New = account younger than newUserMaxDays AND not a prior
 *  purchaser (when a has_purchased/first_purchase signal is present on the user). Cheap + pure. */
export function audienceTypeOf(user: Record<string, unknown> | null | undefined, maxDays = newUserMaxDays()): "new" | "existing" {
  const u = user || {};
  const created = String(u.created_date ?? u.created_at ?? "");
  const ageDays = created ? (Date.now() - new Date(created).getTime()) / 86400000 : Infinity;
  const purchased = u.has_purchased === true || !!u.first_purchase_at || Number(u.orders_count) > 0;
  if (purchased) return "existing";
  return ageDays <= maxDays ? "new" : "existing";
}

/** Normalize advertiser-supplied audience targeting. Accepts { demographics:{field:[...]}, audience_type } or
 *  a flat shape. Returns null when there is nothing usable (→ no audience constraint). */
export function normalizeAudience(raw: unknown): AudienceTargeting | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const src = (r.demographics && typeof r.demographics === "object") ? r.demographics as Record<string, unknown> : r;
  const demographics: Partial<Record<DemographicField, string[]>> = {};
  for (const f of DEMOGRAPHIC_FIELDS) {
    const v = src[f];
    if (Array.isArray(v)) {
      const vals = Array.from(new Set(v.map((x) => String(x).slice(0, 80).trim().toLowerCase()).filter(Boolean))).slice(0, 40);
      if (vals.length) demographics[f] = vals;
    }
  }
  const at = String(r.audience_type ?? "all").toLowerCase();
  const audience_type: AudienceType = (AUDIENCE_TYPES as readonly string[]).includes(at) ? at as AudienceType : "all";
  if (!Object.keys(demographics).length && audience_type === "all") return null;
  return { demographics, audience_type };
}

/** Does the user satisfy an ad's demographic cohort? Missing user demographic → does not match a set field. */
export function matchesDemographics(a: AudienceTargeting | null | undefined, user: Record<string, unknown> | null | undefined): boolean {
  if (!demographicTargetingEnabled()) return true;
  if (!a || !a.demographics || !Object.keys(a.demographics).length) return true;
  const have = userDemographics(user);
  for (const [field, wanted] of Object.entries(a.demographics) as [DemographicField, string[]][]) {
    const hv = have[field];
    if (!hv || !wanted.map((w) => w.toLowerCase()).includes(hv)) return false; // ALL set demographic fields must match
  }
  return true;
}

/** Does the user satisfy an ad's audience-type constraint? */
export function matchesAudienceType(a: AudienceTargeting | null | undefined, user: Record<string, unknown> | null | undefined): boolean {
  if (!a || !a.audience_type || a.audience_type === "all") return true;
  return audienceTypeOf(user) === a.audience_type;
}

/** Combined audience gate: demographics AND audience-type. */
export function userMatchesAudience(a: AudienceTargeting | null | undefined, user: Record<string, unknown> | null | undefined): boolean {
  return matchesDemographics(a, user) && matchesAudienceType(a, user);
}

/** Short human-readable summary for advertiser UI / logs. */
export function audienceSummary(a: AudienceTargeting | null | undefined): string {
  if (!a) return "";
  const parts: string[] = [];
  for (const [f, w] of Object.entries(a.demographics || {})) parts.push(`${f}: ${(w as string[]).join(" / ")}`);
  if (a.audience_type && a.audience_type !== "all") parts.push(`audience: ${a.audience_type} users`);
  return parts.join("; ");
}

/** Normalize an advertiser's optimization objective (what the AI biases delivery toward). */
export function normalizeObjective(raw: unknown): OptimizeObjective {
  const v = String(raw ?? "roas").toLowerCase();
  return (OPTIMIZE_OBJECTIVES as readonly string[]).includes(v) ? v as OptimizeObjective : "roas";
}
