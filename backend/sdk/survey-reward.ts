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
  // 50/50 split: the platform keeps 50% (real cash), and the user accrues 50% of the survey value as
  // NON-CASHABLE points — for BOTH tiers. The premium/non-premium difference is NOT the accrual rate; it's
  // the per-transaction SPEND CAP applied at redemption (premium 24% vs non-premium 12% of the price).
  // So $8 of surveys → the user gets $4 in points, the platform keeps $4 in cash.
  const userSharePct = Math.min(1, Math.max(0, await getNumber("SURVEY_USER_SHARE_PCT", 0.5)));
  const pointCents = Math.max(1, await getNumber("POINT_VALUE_CENTS", 1));
  const userUsd = Math.round(gross * userSharePct * 100) / 100;
  const points = Math.max(0, Math.round(userUsd * 100 / pointCents));
  const realizedUsd = Math.round(points * pointCents) / 100;
  return { isPremium, points, cashUsd: 0, realizedUsd };
}
