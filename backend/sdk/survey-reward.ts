import { getNumber } from "./settings.ts";
import { db } from "./db.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Survey reward tiers (replaces the old flat 50/50 split).
//
//   • NON-PREMIUM users  → earn POINTS: SURVEY_POINTS_PER_DOLLAR points per $1 of
//     survey value (default 12 pts/$ = 12% back, closed-loop / non-cashable).
//   • PREMIUM (PPC) users → earn CASH:  SURVEY_PREMIUM_CASHBACK_PCT of every $1 of
//     survey value (default 0.24 = 24% cash back).
//
// The platform keeps the underlying survey cash in both cases; the user's reward is
// the points (non-premium) or the cash-back slice (premium). Same rule for BitLabs
// (third-party) and the platform's own PPC surveys, so the two paths never diverge.
// ─────────────────────────────────────────────────────────────────────────────

export interface SurveyReward {
  isPremium: boolean;
  points: number;      // points to credit (non-premium); 0 for premium
  cashUsd: number;     // cash to credit to current_balance (premium); 0 for non-premium
  realizedUsd: number; // $ value the user actually received (for total_earned / lifetime)
}

/** Premium = an enrolled loyalty member (same signal used across the app). */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const rows = await db.filter("PremiumPPCMembership", { user_id: userId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  const member = rows[0] || null;
  return !!member?.loyalty_enrolled;
}

/** Compute the tiered reward for a survey worth `grossUsd`. */
export async function computeSurveyReward(isPremium: boolean, grossUsd: number): Promise<SurveyReward> {
  const gross = Math.max(0, Math.round(grossUsd * 100) / 100);
  if (isPremium) {
    const pct = await getNumber("SURVEY_PREMIUM_CASHBACK_PCT", 0.24);
    const cashUsd = Math.round(gross * pct * 100) / 100;
    return { isPremium: true, points: 0, cashUsd, realizedUsd: cashUsd };
  }
  const ppd = await getNumber("SURVEY_POINTS_PER_DOLLAR", 12);
  const pointCents = Math.max(1, await getNumber("POINT_VALUE_CENTS", 1));
  const points = Math.max(0, Math.round(gross * ppd));
  const realizedUsd = Math.round(points * pointCents) / 100;
  return { isPremium: false, points, cashUsd: 0, realizedUsd };
}
