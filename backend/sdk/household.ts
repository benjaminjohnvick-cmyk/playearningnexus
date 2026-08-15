// household.ts — "Family & Teens" accounts, modeled on Amazon Household's teen-login flow.
//
// WHAT THIS IS: one ADULT account holder groups a small set of people under a Household. Each member
// keeps their own login. Members are either:
//   • adult (18+)  — buys on their own, no approval needed;
//   • teen (13–17) — every order is routed to the adult holder to APPROVE, OR auto-approved when it's
//                    at/under a per-order spending limit the holder set for that teen.
//
// SAFETY / COMPLIANCE — READ THIS:
//   The platform is a MONEY-EARNING app with a hard 18+ floor (MIN_AGE, Terms, Privacy, app-store 18+,
//   COPPA / minor-contract). Admitting under-18 users is a real legal change, so TEEN enrollment is
//   gated behind the `teen_accounts` feature flag, which ships OFF (same safe-OFF pattern as
//   `card_charging`). While it's OFF: adult household members work fully; teen invites are refused with
//   a clear message. Turning it ON requires verifiable parental consent, minor-data handling, updated
//   legal docs + app-store rating, and counsel sign-off. Nothing here flips that flag automatically.
//
// Storage: a single `Household` doc { holder_id, name, members[] }, where each member is
//   { user_id, email, role: "adult"|"teen", spend_limit_usd, status, added_at }. For O(1) purchase-time
// gating we ALSO stamp household_id / household_role / household_holder_id / household_spend_limit_usd
// onto the member's User row, so the purchase flow never has to scan households.

import { isEnabled } from "./feature-flags.ts";
import { getNumber } from "./settings.ts";

export type HouseholdRole = "adult" | "teen";

export interface HouseholdMember {
  user_id: string;
  email: string;
  role: HouseholdRole;
  spend_limit_usd: number; // per-order auto-approve threshold for teens (0 = every order needs sign-off)
  status: "active" | "removed";
  added_at: string;
}

/** Is teen (under-18) enrollment currently permitted? OFF until counsel + legal sign-off. */
export async function teenAccountsEnabled(): Promise<boolean> {
  return await isEnabled("teen_accounts").catch(() => false);
}

/** Max members in one household (Amazon allows ~2 adults + 4 teens = 6). */
export async function householdMaxMembers(): Promise<number> {
  return await getNumber("HOUSEHOLD_MAX_MEMBERS", 6);
}

/** Minimum age for a teen household member (13–17 band; teens below this can't be enrolled). */
export async function householdTeenMinAge(): Promise<number> {
  return await getNumber("HOUSEHOLD_TEEN_MIN_AGE", 13);
}

/** Whole-years age from a date-of-birth string, or null if unparseable/absent. */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Known age of a User row from age_verified_18plus + date_of_birth. Returns { known, adult, age }.
 *  `adult` is only true when we AFFIRMATIVELY know they're 18+ (verified flag or a DOB that computes 18+).
 *  `known: false` means we have no age signal (they still passed the 18+ signup gate). */
export function ageStatus(user: Record<string, unknown> | null | undefined): { known: boolean; adult: boolean; age: number | null } {
  const age = ageFromDob((user?.date_of_birth ?? user?.dob) as string | null | undefined);
  if (user?.age_verified_18plus === true) return { known: true, adult: true, age };
  if (age != null) return { known: true, adult: age >= 18, age };
  return { known: false, adult: false, age: null };
}

/**
 * Purchase-time gate. Given the buying user (with its stamped household fields) and the order's USD
 * total, decide whether the order must wait for an adult's approval.
 *   • non-member or adult member → never needs approval.
 *   • teen member → needs approval UNLESS a per-order limit is set and the order is at/under it.
 * Pure + synchronous: it only reads fields already on the user object.
 */
export function purchaseGate(
  user: Record<string, unknown> | null | undefined,
  orderUsd: number,
): { requiresApproval: boolean; isTeen: boolean; household_id: string | null; holder_id: string | null; limit_usd: number; reason: string } {
  const role = (user?.household_role as string) || "";
  const household_id = (user?.household_id as string) || null;
  const holder_id = (user?.household_holder_id as string) || null;
  const limit = Number(user?.household_spend_limit_usd) || 0;
  if (role !== "teen") {
    return { requiresApproval: false, isTeen: false, household_id, holder_id, limit_usd: limit, reason: "not a teen account" };
  }
  const autoApproved = limit > 0 && orderUsd <= limit;
  return {
    requiresApproval: !autoApproved,
    isTeen: true,
    household_id,
    holder_id,
    limit_usd: limit,
    reason: autoApproved ? "within the teen's per-order auto-approve limit" : "teen order needs an adult's approval",
  };
}

/** The stamp we write onto a member's User row so purchaseGate can read it cheaply. */
export function memberStamp(household_id: string, holder_id: string, role: HouseholdRole, spend_limit_usd: number) {
  return {
    household_id,
    household_holder_id: holder_id,
    household_role: role,
    household_spend_limit_usd: Number(spend_limit_usd) || 0,
  };
}

/** Clearing stamp used when a member is removed. */
export function clearStamp() {
  return { household_id: null, household_holder_id: null, household_role: null, household_spend_limit_usd: 0 };
}

export function sanitizeName(name: unknown): string {
  const s = String(name ?? "").trim().slice(0, 60);
  return s || "My Household";
}
