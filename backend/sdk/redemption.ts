// redemption.ts — per-transaction points SPEND CAP + reserve gate.
//
// Users accrue 50% of survey value as non-cashable points (see survey-reward.ts). How much of their balance
// they can spend in a SINGLE transaction is capped: a non-premium user can spend at most 12% of their TOTAL
// points balance at one time, a premium user 24%. This throttles spend velocity so points last and the cash
// reserve is never drained. The whole thing is also gated by the cash RESERVE — points are only spendable to
// the extent the platform actually has cash set aside to honor them (the Growth Engine tracks this). So
// spend is "instantly spendable, based off cash reserves," exactly as specified.

import { snapNumber } from "./settings.ts";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

export const pointsRedeemCapPctNonPremium = () => clamp01(snapNumber("POINTS_REDEEM_MAX_PCT_NONPREMIUM", 0.12));
export const pointsRedeemCapPctPremium = () => clamp01(snapNumber("POINTS_REDEEM_MAX_PCT_PREMIUM", 0.24));

/** The per-transaction spend cap for this tier (fraction of the user's TOTAL points balance spendable at
 *  once). Non-premium 12%, premium 24%. */
export function pointsRedeemCapPct(isPremium: boolean): number {
  return isPremium ? pointsRedeemCapPctPremium() : pointsRedeemCapPctNonPremium();
}

/**
 * Max points a user may spend in ONE transaction — the smaller of:
 *   • the tier cap — capPct × their TOTAL points balance (12% non-premium / 24% premium), and
 *   • the reserve  — how many points the platform can currently afford to honor (pass the Growth Engine's
 *                    spendable headroom in points; omit or pass a negative number to skip the reserve gate).
 */
export function maxPointsPerTransaction(opts: {
  isPremium: boolean; userPoints: number; reserveSpendablePoints?: number;
}): { points: number; capPct: number; limited_by: "cap" | "reserve" } {
  const capPct = pointsRedeemCapPct(opts.isPremium);
  const byCap = Math.floor(Math.max(0, Number(opts.userPoints) || 0) * capPct);
  const byReserve = (opts.reserveSpendablePoints === undefined || opts.reserveSpendablePoints < 0)
    ? Infinity : Math.floor(opts.reserveSpendablePoints);
  const points = Math.max(0, Math.min(byCap, byReserve));
  return { points, capPct, limited_by: points === byCap ? "cap" : "reserve" };
}
