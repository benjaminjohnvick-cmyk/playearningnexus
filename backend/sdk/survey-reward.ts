import { getNumber, snapBool, snapNumber } from "./settings.ts";
import { db } from "./db.ts";
import { cacheGet, cacheSet } from "./cache.ts";
import { applyMarketplaceEquivHold } from "./marketplace-fee.ts";

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
/** Are premium seats still open? Everyone is premium by default (PREMIUM_DEFAULT_ALL) UNTIL the seat cap
 *  (PREMIUM_SEAT_CAP) is reached — after that, new users stay non-premium and fall back to the third-party
 *  survey networks (all of which ship ON). cap<=0 = unlimited (no counting). Bounded + cached (10 min). */
export async function premiumSeatsOpen(): Promise<boolean> {
  const cap = snapNumber("PREMIUM_SEAT_CAP", 0);
  if (cap <= 0) return true;
  const hit = await cacheGet<boolean>("premium_seats_open").catch(() => null);
  if (typeof hit === "boolean") return hit;
  const rows = await db.filter("User", {}, "-created_date", cap + 1).catch(() => []) as unknown[];
  const open = (rows?.length || 0) <= cap;   // found more than cap users → seats full
  await cacheSet("premium_seats_open", open, 600).catch(() => null);
  return open;
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const rows = await db.filter("PremiumPPCMembership", { user_id: userId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  if (rows[0]?.loyalty_enrolled) return true;
  // Everyone premium by default (until the seat cap fills; then fall back to third-party surveys).
  if (snapBool("PREMIUM_DEFAULT_ALL", true) && await premiumSeatsOpen()) return true;
  return false;
}

/** Compute the tiered reward for a survey worth `grossUsd`. `userSharePctOverride` (0–1) lets a caller force
 *  a specific accrual share — used for the founding full-keep benefit (1.0 = keep 100%) until its cap. */
export async function computeSurveyReward(isPremium: boolean, grossUsd: number, userSharePctOverride?: number): Promise<SurveyReward> {
  const gross = Math.max(0, Math.round(grossUsd * 100) / 100);
  // Revised flywheel #3: you hold no inventory, so instead of seller commission you hold back an equal % of
  // GROSS survey revenue as the marketplace-equivalent line. Applied FIRST, before the user share — so the
  // user share is computed on the net gross. Disclosed to users (Terms + earn-rate page). No-op when the
  // MARKETPLACE_EQUIV_HOLD_ENABLED flag is off.
  const { net_gross_usd: netGross } = applyMarketplaceEquivHold(gross);
  // 50/50 split: the platform keeps 50% (real cash), and the user accrues 50% of the (net) survey value as
  // NON-CASHABLE points — for BOTH tiers. The premium/non-premium difference is NOT the accrual rate; it's
  // the per-transaction SPEND CAP applied at redemption (premium 24% vs non-premium 12% of the price).
  const userSharePct = (typeof userSharePctOverride === "number")
    ? Math.min(1, Math.max(0, userSharePctOverride))
    : Math.min(1, Math.max(0, await getNumber("SURVEY_USER_SHARE_PCT", 0.5)));
  const pointCents = Math.max(1, await getNumber("POINT_VALUE_CENTS", 1));
  const userUsd = Math.round(netGross * userSharePct * 100) / 100;
  const points = Math.max(0, Math.round(userUsd * 100 / pointCents));
  const realizedUsd = Math.round(points * pointCents) / 100;
  return { isPremium, points, cashUsd: 0, realizedUsd };
}
