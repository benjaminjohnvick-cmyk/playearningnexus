// premium-finance.ts — pay for Premium with NO upfront charge, financed out of earnings.
//
// The member is granted Premium immediately; $1/day is then deducted from their earned Site Cash toward the
// membership price. It's pay-as-you-earn from a rewards balance — nothing is fronted, so it's NOT lending:
// if they under-earn and never cover the price, they simply downgrade to the free tier (no debt, no
// clawback, no collection). Any overpayment at cycle end returns to them as Site Cash. See
// PREMIUM-FINANCE-FROM-EARNINGS.md.

import { snapNumber, snapBool } from "./settings.ts";
import { premiumPricing } from "./earn-back.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const premiumFinanceEnabled = () => snapBool("PREMIUM_FINANCE_ENABLED", true);

/** Site Cash deducted per earning day toward the membership. */
export const financeDailyUsd = () => Math.max(0, snapNumber("PREMIUM_FINANCE_DAILY_USD", 1));

/** Length of a finance cycle in days. */
export const financeCycleDays = () => Math.max(1, Math.round(snapNumber("PREMIUM_FINANCE_CYCLE_DAYS", 30)));

/** Cumulative earnings that flag a cycle a "successful month" (recognition/streak only). */
export const financeSuccessMonthlyUsd = () => Math.max(0, snapNumber("PREMIUM_FINANCE_SUCCESS_MONTHLY_USD", 216));

/** The membership price this member is financing — founding vs sustainable, per premiumPricing(). */
export function financePriceUsd(opts: { memberJoinedFounding?: boolean } = {}): number {
  return round2(premiumPricing({ memberJoinedFounding: opts.memberJoinedFounding }).price_usd);
}

/** Whole days elapsed between two YYYY-MM-DD day keys (b - a). */
export function daysBetween(aDay: string, bDay: string): number {
  const a = Date.parse(`${aDay}T00:00:00Z`);
  const b = Date.parse(`${bDay}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

export interface CycleOutcome {
  covered: boolean;        // did deductions reach the price?
  excess_usd: number;      // overpayment to return as Site Cash (always returned)
  qualified: boolean;      // hit the monthly earning target (successful-month flag)
  downgrade: boolean;      // price not covered → drop to free tier
}

/** Decide what happens when a finance cycle closes, given the totals accrued during it. */
export function cycleOutcome(opts: { deductedUsd: number; priceUsd: number; monthEarningsUsd: number }): CycleOutcome {
  const deducted = Math.max(0, Number(opts.deductedUsd) || 0);
  const price = Math.max(0, Number(opts.priceUsd) || 0);
  const covered = deducted >= price - 0.005;
  return {
    covered,
    excess_usd: round2(Math.max(0, deducted - price)),   // only positive when covered; always returned
    qualified: (Number(opts.monthEarningsUsd) || 0) >= financeSuccessMonthlyUsd() - 0.005,
    downgrade: !covered,
  };
}
