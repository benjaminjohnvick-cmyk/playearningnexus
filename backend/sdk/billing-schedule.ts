// billing-schedule.ts — "52 weeks up front, tracked in 13 four-week cycles" for every advertiser tier.
//
// WHAT THIS IS (and is NOT):
//   • Advertisers PREPAY the full 52 weeks (one year) UP FRONT — a single prepayment for advertising services,
//     collected at signup through the normal (card_charging-gated) checkout. This is NOT credit, NOT an
//     installment plan, NOT a recurring auto-charge: nothing is billed later and nothing is owed later.
//   • The year is then TRACKED/REPORTED as 13 four-week cycles (13 × 28 days = 364 days ≈ 52 weeks). Cycles are
//     an accounting/delivery-pacing lens — how the prepaid amount is recognized and how delivery paces over the
//     year — they are NOT 13 separate charges.
//
// Same compliance spine as the rest of the platform: prepay = prepayment (unearned revenue recognized as
// delivery/time elapses), never a return/revenue/ROI promise. Tracks/quotes only; moves no money.
import { snapNumber, snapBool } from "./settings.ts";
import { foundingPriceUsd } from "./founding-advertiser.ts";
import { tier2TotalUsd } from "./tier2-scaling.ts";
import { tier3UnlimitedQuote } from "./tier3-unlimited.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const DAY_MS = 86400000;

export type BillingTier = "tier1" | "tier2" | "tier3";

export const billingAnnualPrepayEnabled = () => snapBool("BILLING_ANNUAL_PREPAY_ENABLED", true);
/** Number of billing/reporting cycles in a year (13 four-week cycles). */
export const billingCycles = () => Math.max(1, Math.round(snapNumber("BILLING_CYCLES", 13)));
/** Length of one cycle in days (28 = four weeks; 13 × 28 = 364 ≈ 52 weeks). */
export const billingCycleDays = () => Math.max(1, Math.round(snapNumber("BILLING_CYCLE_DAYS", 28)));

/** The full-year (52-week) amount collected UP FRONT for a tier. Tier 3 scales with the advertiser's budget. */
export function annualPrepayAmount(tier: BillingTier, opts?: { budgetUsd?: number }): number {
  if (tier === "tier1") return round2(foundingPriceUsd());
  if (tier === "tier2") return round2(tier2TotalUsd());
  // tier3 — the named budget is the annual prepay (clamped to the Tier 3 floor by the quote).
  return round2(tier3UnlimitedQuote(Number(opts?.budgetUsd) || 0).budget_usd);
}

export interface BillingCycleRow {
  n: number;                 // 1..cycles
  starts_on: string;         // ISO date (inclusive)
  ends_on: string;           // ISO date (inclusive)
  recognized_usd: number;    // amount of the upfront prepay recognized as this cycle elapses
  cumulative_usd: number;    // recognized through the end of this cycle
}

/** Build the 13-cycle ladder for an annual prepay anchored at `termStartISO`. The prepay is collected up front;
 *  each 28-day cycle RECOGNIZES an equal share (the last cycle absorbs rounding so the cumulative hits the exact
 *  annual amount). Pure — dates derive from the term start only. */
export function cycleLadder(annualUsd: number, termStartISO: string): BillingCycleRow[] {
  const cycles = billingCycles();
  const days = billingCycleDays();
  const annual = round2(annualUsd);
  const start = Date.parse(String(termStartISO || ""));
  const per = round2(annual / cycles);
  const rows: BillingCycleRow[] = [];
  let cum = 0;
  for (let n = 1; n <= cycles; n++) {
    const recognized = n === cycles ? round2(annual - cum) : per; // last cycle absorbs rounding
    cum = round2(cum + recognized);
    const startMs = Number.isFinite(start) ? start + (n - 1) * days * DAY_MS : NaN;
    const endMs = Number.isFinite(start) ? start + n * days * DAY_MS - DAY_MS : NaN;
    rows.push({
      n,
      starts_on: Number.isFinite(startMs) ? new Date(startMs).toISOString().slice(0, 10) : "",
      ends_on: Number.isFinite(endMs) ? new Date(endMs).toISOString().slice(0, 10) : "",
      recognized_usd: recognized,
      cumulative_usd: cum,
    });
  }
  return rows;
}

export interface BillingScheduleStatus {
  enabled: boolean;
  tier: BillingTier;
  collect_mode: "upfront";       // always upfront — the full year is prepaid, never billed per cycle
  annual_prepay_usd: number;     // the full 52-week amount collected up front
  collected_upfront_usd: number; // = annual_prepay_usd (one charge at signup)
  cycles: number;                // 13
  cycle_days: number;            // 28
  term_start: string;
  current_cycle: number;         // 1..cycles (0 before start / bad date)
  cycles_elapsed: number;        // fully-completed cycles
  recognized_to_date_usd: number;// prepay recognized as delivered so far
  term_complete: boolean;        // all cycles elapsed (year served)
  ladder: BillingCycleRow[];
  note: string;
}

/** The full billing picture for one advertiser seat/plan as of `nowMs`. The advertiser already paid the whole
 *  year up front; this reports which four-week cycle they're in and how much of the prepay has been recognized. */
export function billingScheduleStatus(tier: BillingTier, annualUsd: number, termStartISO: string, nowMs: number): BillingScheduleStatus {
  const cycles = billingCycles();
  const days = billingCycleDays();
  const annual = round2(annualUsd);
  const ladder = cycleLadder(annual, termStartISO);
  const start = Date.parse(String(termStartISO || ""));

  let cyclesElapsed = 0, currentCycle = 0;
  if (Number.isFinite(start) && nowMs >= start) {
    cyclesElapsed = Math.min(cycles, Math.floor((nowMs - start) / (days * DAY_MS)));
    currentCycle = Math.min(cycles, cyclesElapsed + 1);
  }
  const recognized = cyclesElapsed > 0 ? round2(ladder[cyclesElapsed - 1].cumulative_usd) : 0;
  const termComplete = cyclesElapsed >= cycles;

  const progress = termComplete
    ? "All cycles have elapsed."
    : "You are in cycle " + currentCycle + " of " + cycles + "; $" + recognized.toLocaleString() + " recognized so far.";

  return {
    enabled: billingAnnualPrepayEnabled(),
    tier,
    collect_mode: "upfront",
    annual_prepay_usd: annual,
    collected_upfront_usd: annual,
    cycles, cycle_days: days,
    term_start: String(termStartISO || ""),
    current_cycle: currentCycle,
    cycles_elapsed: cyclesElapsed,
    recognized_to_date_usd: recognized,
    term_complete: termComplete,
    ladder,
    note: `You prepaid the full 52 weeks up front ($${annual.toLocaleString()}). We track and deliver it across ` +
      `${cycles} four-week cycles (${days} days each). ${progress} ` +
      `This is a single prepayment for advertising — not an installment plan and not a recurring charge.`,
  };
}
