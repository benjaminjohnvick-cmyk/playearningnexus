// buddy-profile.ts — turn a user's KYC (first-survey) answers into a browsable, privacy-safe buddy profile.
//
// People can browse these cards and pick their own match instead of (or in addition to) the auto-matcher.
// PRIVACY: a card exposes ONLY interest fields from KYC (categories, goals, game genres, style, device) plus a
// FIRST NAME and country. It never exposes email, full name, free-text answers, financial/budget answers, age,
// or any custom survey field. Browsing is opt-in: a user is only listed once they set their profile public.

import { snapBool } from "./settings.ts";
import { kycAffinity } from "./buddy-schedule.ts";

export const profileBrowseEnabled = () => snapBool("BUDDY_PROFILE_BROWSE_ENABLED", false);

/** Interest fields that are safe to show on a public buddy card. Deliberately excludes interests_text (free
 *  text may contain PII), shopping_budget (financial), and any custom/unknown survey field. */
const SAFE_LIST_FIELDS = ["categories", "goals", "game_genres"] as const;
const SAFE_SCALAR_FIELDS = ["shopping_style", "device"] as const;

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 12) : [];

export interface BuddyCard {
  user_id: string;
  display_name: string;      // FIRST NAME only
  country: string | null;
  interests: string[];       // categories
  goals: string[];
  game_genres: string[];
  style: string | null;
  device: string | null;
  affinity: number;          // KYC compatibility vs the viewer (higher = more in common)
  shared: string[];          // the specific interests you have in common
}

/** True if this user has opted their profile into browsing. */
export function isProfilePublic(user: Record<string, unknown> | null | undefined): boolean {
  return !!(user && user.buddy_profile_public === true);
}

/** The specific overlapping interests between a viewer and a candidate (for "you both like …"). */
export function sharedInterests(viewerKyc: Record<string, unknown> | null | undefined, candidateKyc: Record<string, unknown> | null | undefined): string[] {
  if (!viewerKyc || !candidateKyc) return [];
  const out: string[] = [];
  for (const f of SAFE_LIST_FIELDS) {
    const mine = new Set(asList((viewerKyc as Record<string, unknown>)[f]).map((s) => s.toLowerCase()));
    for (const v of asList((candidateKyc as Record<string, unknown>)[f])) if (mine.has(v.toLowerCase())) out.push(v);
  }
  return [...new Set(out)].slice(0, 12);
}

/** Build a privacy-safe browse card for `candidate`, scored against the `viewer`'s KYC. Pure. */
export function buildBuddyCard(candidate: Record<string, unknown>, viewerKyc: Record<string, unknown> | null | undefined): BuddyCard {
  const kyc = (candidate.kyc_answers as Record<string, unknown>) || {};
  const firstName = candidate.full_name ? String(candidate.full_name).trim().split(/\s+/)[0] : "Member";
  return {
    user_id: String(candidate.id),
    display_name: firstName,
    country: (candidate.country as string) || null,
    interests: asList(kyc[SAFE_LIST_FIELDS[0]]),
    goals: asList(kyc[SAFE_LIST_FIELDS[1]]),
    game_genres: asList(kyc[SAFE_LIST_FIELDS[2]]),
    style: kyc[SAFE_SCALAR_FIELDS[0]] ? String(kyc[SAFE_SCALAR_FIELDS[0]]) : null,
    device: kyc[SAFE_SCALAR_FIELDS[1]] ? String(kyc[SAFE_SCALAR_FIELDS[1]]) : null,
    affinity: kycAffinity(viewerKyc, kyc),
    shared: sharedInterests(viewerKyc, kyc),
  };
}
