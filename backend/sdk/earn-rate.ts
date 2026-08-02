// earn-rate.ts — survey-minutes → Site Cash → item ownership math.
//
// The user experience: survey completion time earns Site Cash (closed-loop, non-cashable dollars that
// spend ONLY on this site). Given an item's price and the per-minute earn rate, an AI/deterministic
// process shows how many minutes of surveys it takes to "own" 1%…100% of that item. "Ownership %" is
// just the share of the item's price the user has covered with earned Site Cash; at 100% the item is
// fully covered and ships to them. Below 100% the ownership % comes off the price as a cash discount.
//
// Earn rates (admin-tunable):
//   • Non-premium: 1.5¢/min  (= 90¢/hour), capped at $8/day.
//   • Premium:     $1.00/min (= 8 min → $8), capped at $8/day.
// Both tiers cap at $8/day of earned Site Cash, exactly as specified.
//
// NOTHING here converts Site Cash to bank cash. Ownership only ever becomes a discount or a fully-covered
// item — never a payout to a debit card, checking/savings, or a P2P app. That is what keeps the model a
// closed-loop rewards store and out of money-transmitter / securities territory.

import { snapNumber } from "./settings.ts";

const clampPct = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));

/** Per-minute earn rate in USD for the tier. */
export function earnRateUsdPerMin(isPremium: boolean): number {
  const cents = isPremium
    ? snapNumber("EARN_PREMIUM_CENTS_PER_MIN", 100)
    : snapNumber("EARN_NONPREMIUM_CENTS_PER_MIN", 1.5);
  return Math.max(0, cents) / 100;
}

/** Daily cap on earned Site Cash (USD). Premium members keep the FULL PREMIUM_DAILY_PORTION_USD ($7/day);
 *  the $1/day subscription fee is ON TOP (covered by the prepaid annual subscription), not deducted here.
 *  Non-premium uses EARN_DAILY_CAP_USD ($8). All amounts are closed-loop Site Cash — never a cash payout.
 *  Annual premium portion: minimum $1,820 (5 days/week) up to maximum $2,555 (7 days/week). */
export function earnDailyCapUsd(isPremium = false): number {
  return isPremium
    ? Math.max(0, snapNumber("PREMIUM_DAILY_PORTION_USD", 7))
    : Math.max(0, snapNumber("EARN_DAILY_CAP_USD", 8));
}

/** Premium's full daily Site Cash portion ($7/day, member keeps all of it) and the separate $1/day
 *  subscription fee charged ON TOP (via the prepaid annual subscription). */
export const premiumDailyPortionUsd = () => Math.max(0, snapNumber("PREMIUM_DAILY_PORTION_USD", 7));
export const premiumDailySubFeeUsd = () => Math.max(0, snapNumber("PREMIUM_FINANCE_DAILY_USD", 1));

/** How much Site Cash (USD) is needed to own `ownershipPct` of an item priced `priceUsd`. */
export function usdForOwnership(priceUsd: number, ownershipPct: number): number {
  const price = Math.max(0, Number(priceUsd) || 0);
  return Math.round(price * (clampPct(ownershipPct) / 100) * 100) / 100;
}

/** Ownership % a user's current Site Cash covers on an item (0–100). */
export function ownershipPctFromCash(priceUsd: number, cashUsd: number): number {
  const price = Math.max(0, Number(priceUsd) || 0);
  if (price <= 0) return 0;
  return clampPct((Math.max(0, Number(cashUsd) || 0) / price) * 100);
}

export interface OwnershipStep {
  pct: number;          // ownership percent (1–100)
  usd_needed: number;   // Site Cash needed to reach this %
  minutes: number;      // survey minutes to earn it at the tier rate
  days_at_cap: number;  // whole days if earning at the $8/day cap
}

/** Minutes (and days-at-cap) of surveys to reach a given ownership % of an item. */
export function minutesToOwn(opts: { priceUsd: number; ownershipPct: number; isPremium: boolean }): OwnershipStep {
  const pct = clampPct(opts.ownershipPct);
  const usd = usdForOwnership(opts.priceUsd, pct);
  const ratePerMin = earnRateUsdPerMin(opts.isPremium);
  const cap = earnDailyCapUsd();
  const minutes = ratePerMin > 0 ? Math.ceil(usd / ratePerMin) : Infinity;
  const days = cap > 0 ? Math.ceil(usd / cap) : Infinity;
  return { pct, usd_needed: usd, minutes, days_at_cap: days };
}

/** Milestone ownership table for the UI (1%, 5%, 10%, 25%, 50%, 75%, 100%). */
export function ownershipTable(opts: { priceUsd: number; isPremium: boolean }): OwnershipStep[] {
  return [1, 5, 10, 25, 50, 75, 100].map((pct) =>
    minutesToOwn({ priceUsd: opts.priceUsd, ownershipPct: pct, isPremium: opts.isPremium }),
  );
}

/** Max share of an item a user may earn back as a discount (the rest is paid out of pocket). */
export function buyerMaxDiscountPct(): number {
  return clampPct(snapNumber("BUYER_MAX_DISCOUNT_PCT", 0.50) * 100);   // stored as a fraction (0.50 = 50%)
}

export interface OwnershipSplit {
  price_usd: number;
  out_of_pocket_pct: number;   // % the user pays by card now
  earn_back_pct: number;       // % they earn back via surveys (the ownership discount)
  max_discount_pct: number;    // policy cap on earn-back
  minutes: number;             // survey minutes to earn the earn-back %
  days_at_cap: number;
  out_of_pocket_usd: number;   // dollars they actually pay (kept internal; UI can lead with %)
}

/**
 * Given an item price and how much the user wants to pay OUT OF POCKET, split it into: the % paid now vs the
 * % earned back via surveys (capped by the max-discount policy), plus the survey minutes to earn that back.
 * Percentages + minutes are the headline; dollars are included but the UI leads with %.
 */
export function ownershipSplit(opts: { priceUsd: number; outOfPocketUsd: number; isPremium: boolean }): OwnershipSplit {
  const price = Math.max(0, Number(opts.priceUsd) || 0);
  const maxDiscount = buyerMaxDiscountPct();                 // e.g. 50
  const minOutOfPocketPct = Math.max(0, 100 - maxDiscount);  // e.g. 50
  // Clamp the requested out-of-pocket to [minOutOfPocket .. 100%].
  let oopPct = price > 0 ? clampPct((Math.max(0, Number(opts.outOfPocketUsd) || 0) / price) * 100) : 100;
  oopPct = Math.min(100, Math.max(minOutOfPocketPct, oopPct));
  const earnBackPct = Math.round((100 - oopPct) * 100) / 100;
  const step = minutesToOwn({ priceUsd: price, ownershipPct: earnBackPct, isPremium: opts.isPremium });
  return {
    price_usd: Math.round(price * 100) / 100,
    out_of_pocket_pct: Math.round(oopPct * 100) / 100,
    earn_back_pct: earnBackPct,
    max_discount_pct: maxDiscount,
    minutes: step.minutes,
    days_at_cap: step.days_at_cap,
    out_of_pocket_usd: Math.round(price * (oopPct / 100) * 100) / 100,
  };
}
