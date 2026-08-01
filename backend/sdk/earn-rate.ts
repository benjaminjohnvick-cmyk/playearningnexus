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

/** Daily cap on earned Site Cash (USD). Same $8/day for both tiers by default. */
export function earnDailyCapUsd(): number {
  return Math.max(0, snapNumber("EARN_DAILY_CAP_USD", 8));
}

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
