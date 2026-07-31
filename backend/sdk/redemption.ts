// redemption.ts — per-transaction points SPEND CAP + reserve gate.
//
// Users accrue 50% of survey value as non-cashable points (see survey-reward.ts). How much of that they can
// apply to a SINGLE purchase is capped: non-premium 12%, premium 24% of the item price. And the whole thing
// is gated by the cash RESERVE — points are only spendable to the extent the platform actually has cash set
// aside to honor them (the Growth Engine tracks this). So spend is "instantly spendable, based off cash
// reserves," exactly as specified — never a promise the platform can't back.

import { snapNumber } from "./settings.ts";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

export const pointsRedeemCapPctNonPremium = () => clamp01(snapNumber("POINTS_REDEEM_MAX_PCT_NONPREMIUM", 0.12));
export const pointsRedeemCapPctPremium = () => clamp01(snapNumber("POINTS_REDEEM_MAX_PCT_PREMIUM", 0.24));

/** The per-transaction spend cap for this tier (fraction of the item price payable in points). */
export function pointsRedeemCapPct(isPremium: boolean): number {
  return isPremium ? pointsRedeemCapPctPremium() : pointsRedeemCapPctNonPremium();
}

/**
 * Max points a user may apply to ONE purchase, in points. The smallest of:
 *   • the tier cap  — capPct × price,
 *   • their balance — how many points they actually hold,
 *   • the reserve   — how much the platform can currently afford to honor (pass the Growth Engine's
 *                     spendable headroom in USD; pass a negative number to skip the reserve gate).
 */
export function maxPointsForPurchase(opts: {
  isPremium: boolean; priceUsd: number; userPoints: number; pointUsd: number; reserveSpendableUsd?: number;
}): { points: number; usd: number; capPct: number; limited_by: "cap" | "balance" | "reserve" } {
  const price = Math.max(0, Number(opts.priceUsd) || 0);
  const pointUsd = Math.max(0.0001, Number(opts.pointUsd) || 0.01);
  const capPct = pointsRedeemCapPct(opts.isPremium);
  const capUsd = price * capPct;
  const balanceUsd = Math.max(0, Number(opts.userPoints) || 0) * pointUsd;
  const reserveUsd = (opts.reserveSpendableUsd === undefined || opts.reserveSpendableUsd < 0) ? Infinity : opts.reserveSpendableUsd;

  const usd = Math.min(capUsd, balanceUsd, reserveUsd);
  const limited_by = usd === capUsd ? "cap" : (usd === balanceUsd ? "balance" : "reserve");
  return { points: Math.max(0, Math.floor(usd / pointUsd)), usd: Math.round(usd * 100) / 100, capPct, limited_by };
}
