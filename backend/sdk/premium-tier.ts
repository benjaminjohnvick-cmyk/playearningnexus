// premium-tier.ts — the two ways into Premium and the tier's survey routing.
//
// EARNED path: complete the daily survey goal on PREMIUM_AUTOQUALIFY_DAYS days within the trailing year AND
// have PREMIUM_REQUIRED_REFERRALS (default 3) successful referrals. Then the free one-tap upgrade unlocks.
// FOUNDING path: the first PREMIUM_FOUNDING_COHORT_SIZE members can opt in FREE immediately — seeds the
// premium tier from launch so the premium revenue stream starts on day one.
//
// Survey routing: premium users get the PPC AdGrid surveys; non-premium users get BitLabs surveys.

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";

/** Successful referrals for a user = converted/active Referral rows they own. */
export async function countSuccessfulReferrals(userId: string): Promise<number> {
  if (!userId) return 0;
  const active = await db.filter("Referral", { referrer_user_id: userId, status: "active" }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
  if (active && active.length) return active.length;
  // Fallback: some flows mark conversion via signup_bonus_paid rather than status.
  const paid = await db.filter("Referral", { referrer_user_id: userId, signup_bonus_paid: true }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
  return (paid || []).length;
}

/** How many members are already enrolled in Premium (for founding-seat availability). Bounded scan. */
export async function enrolledPremiumCount(): Promise<number> {
  const rows = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
  return (rows || []).filter((m) => m.status !== "ended").length;
}

/** Which survey provider a user is served: premium → PPC AdGrid, non-premium → BitLabs. */
export function surveyProviderForTier(isPremium: boolean): "ppc_adgrid" | "bitlabs" {
  return isPremium ? "ppc_adgrid" : "bitlabs";
}

export interface PremiumQualification {
  earned: boolean;
  founding_available: boolean;
  eligible: boolean;              // earned OR founding
  path: "earned" | "founding" | null;
  referrals: number;
  referrals_required: number;
  founding_seats: number;
  founding_taken: number;
}

/** Combine the earned check (days already computed by the caller) with referrals + founding availability. */
export async function premiumQualification(userId: string, qualifyingDays: number, daysRequired: number): Promise<PremiumQualification> {
  const referralsRequired = Math.max(0, Math.round(await getNumber("PREMIUM_REQUIRED_REFERRALS", 3)));
  const foundingSeats = Math.max(0, Math.round(await getNumber("PREMIUM_FOUNDING_COHORT_SIZE", 1000)));
  const referrals = await countSuccessfulReferrals(userId);
  const earned = qualifyingDays >= daysRequired && referrals >= referralsRequired;
  const taken = foundingSeats > 0 ? await enrolledPremiumCount() : 0;
  const founding_available = foundingSeats > 0 && taken < foundingSeats;
  const eligible = earned || founding_available;
  return {
    earned, founding_available, eligible,
    path: earned ? "earned" : (founding_available ? "founding" : null),
    referrals, referrals_required: referralsRequired,
    founding_seats: foundingSeats, founding_taken: taken,
  };
}
