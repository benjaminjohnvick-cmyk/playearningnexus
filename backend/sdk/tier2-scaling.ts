// tier2-scaling.ts — Tier 2 "Scale" bought in 30-day PARTS. This is PAY-AS-YOU-GO (each part is a separate
// upfront purchase), NOT financing/credit — so no lending gate applies. The total is split into equal monthly
// parts; each part runs at least TIER2_PART_MIN_DAYS, then the advertiser buys the next part and scales up
// based on results. Completing all parts within the term finishes Tier 2 (12 parts ≈ one year).
//
// Rollover discount: 6% (FOUNDING_UPGRADE_DISCOUNT_PCT) off each part. It applies in the FIRST YEAR for anyone
// rolling up from Tier 1; FOUNDING members (holders of a founding Tier 1 seat) keep it in PERPETUITY.
import { snapBool, snapNumber } from "./settings.ts";
import { upgradePriceUsd, upgradeName, upgradeDiscountPct } from "./founding-rollover.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const MS_PER_DAY = 86400000;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const tier2Parts = () => Math.max(1, Math.round(snapNumber("TIER2_PARTS", 12)));
export const tier2PartMinDays = () => Math.max(1, snapNumber("TIER2_PART_MIN_DAYS", 30));
export const tier2TermMonths = () => Math.max(1, snapNumber("TIER2_TERM_MONTHS", 12));
export const tier2PartMinResultsMult = () => Math.max(0, snapNumber("TIER2_PART_MIN_RESULTS_MULT", 0));
export const tier2DiscountFirstYearOnly = () => snapBool("TIER2_DISCOUNT_FIRST_YEAR_ONLY", true);
export const tier2FoundingDiscountPerpetual = () => snapBool("TIER2_FOUNDING_DISCOUNT_PERPETUAL", true);
export const tier2TotalUsd = () => upgradePriceUsd();       // $200,000
export const tier2Name = () => upgradeName();               // "Tier 2 — Scale"
export const tier2DiscountPct = () => upgradeDiscountPct(); // 6%

// ── The discount rule ───────────────────────────────────────────────────────────────────────────────────
/** The discount rate that applies right now. Founding members keep it forever (if perpetual is on); everyone
 *  else gets it only within the first year of Tier 2 (if first-year-only is on). */
export function tier2DiscountRate(isFounding: boolean, monthsSinceTier2Start: number): number {
  const pct = tier2DiscountPct();
  if (isFounding && tier2FoundingDiscountPerpetual()) return pct;
  if (!tier2DiscountFirstYearOnly()) return pct;          // discount never expires (admin choice)
  return (Number(monthsSinceTier2Start) || 0) < tier2TermMonths() ? pct : 0;
}

// ── The ladder ──────────────────────────────────────────────────────────────────────────────────────────
export interface Tier2Part { n: number; base_amount_usd: number; cumulative_base_usd: number; }
/** Equal parts summing exactly to the total (last part absorbs rounding). */
export function tier2Ladder(): Tier2Part[] {
  const total = tier2TotalUsd();
  const n = tier2Parts();
  const per = Math.floor((total / n) * 100) / 100;
  const parts: Tier2Part[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const base = isLast ? r2(total - allocated) : per;
    allocated = r2(allocated + base);
    parts.push({ n: i + 1, base_amount_usd: base, cumulative_base_usd: allocated });
  }
  return parts;
}

function monthsBetween(startISO: string, todayISO: string): number {
  const s = Date.parse(startISO), t = Date.parse(todayISO || new Date().toISOString());
  if (!Number.isFinite(s) || !Number.isFinite(t) || t < s) return 0;
  return Math.floor((t - s) / (MS_PER_DAY * 30));
}

export interface Tier2Status {
  name: string; total_usd: number; parts: number; part_min_days: number; term_months: number;
  is_founding: boolean;
  parts_completed: number; complete: boolean;
  current_part_number: number | null;               // the next part to buy (1-based), null if complete
  current_part_base_usd: number | null;
  discount_pct: number;                              // effective right now
  discount_perpetual: boolean;                       // true if this member keeps it forever
  current_part_net_usd: number | null;               // base − discount
  paid_usd: number;
  next_part_eligible: boolean;
  days_until_next_part: number;                       // 0 if the 30-day gate is met
  results_gate_met: boolean;
  reason: string;
  ladder: Tier2Part[];
}

/** Compute the status/next-part decision for a member's Tier 2 scaling plan.
 *  `rec` is their Tier2ScalingPlan row (or null if they haven't started). `lastPartResultsUsd` is the real
 *  attributed result accrued on the current part (used for the results gate). */
export function tier2Status(
  rec: Record<string, unknown> | null,
  isFounding: boolean,
  todayISO: string,
  lastPartResultsUsd = 0,
): Tier2Status {
  const ladder = tier2Ladder();
  const startedISO = String(rec?.started_at ?? todayISO);
  const partStartedISO = String(rec?.current_part_started_at ?? rec?.started_at ?? "");
  const partsCompleted = Math.max(0, Math.min(ladder.length, Number(rec?.parts_completed) || 0));
  const paidUsd = r2(Number(rec?.paid_usd) || 0);
  const complete = partsCompleted >= ladder.length;
  const monthsSinceStart = rec ? monthsBetween(startedISO, todayISO) : 0;
  const discountRate = tier2DiscountRate(isFounding, monthsSinceStart);
  const perpetual = isFounding && tier2FoundingDiscountPerpetual();

  const currentPart = complete ? null : ladder[partsCompleted];
  const base = currentPart ? currentPart.base_amount_usd : null;
  const net = base != null ? r2(base * (1 - discountRate)) : null;

  // 30-day pacing gate: only applies once at least one part is in progress.
  let daysUntil = 0, gateReason = "";
  if (rec && partStartedISO && partsCompleted > 0 && !complete) {
    const elapsedDays = (Date.parse(todayISO) - Date.parse(partStartedISO)) / MS_PER_DAY;
    const remaining = Math.ceil(tier2PartMinDays() - elapsedDays);
    if (Number.isFinite(remaining) && remaining > 0) { daysUntil = remaining; gateReason = `Current part needs ${remaining} more day(s) before you can buy the next.`; }
  }

  // Results gate: the current part must have returned at least mult × its price.
  const mult = tier2PartMinResultsMult();
  const priorBase = partsCompleted > 0 ? ladder[partsCompleted - 1].base_amount_usd : 0;
  const resultsNeeded = r2(priorBase * mult);
  const resultsMet = mult <= 0 || partsCompleted === 0 || (Number(lastPartResultsUsd) || 0) >= resultsNeeded;
  if (!resultsMet && !gateReason) gateReason = `To scale up, the last part should have returned at least $${resultsNeeded.toLocaleString()} (it has $${r2(lastPartResultsUsd).toLocaleString()}).`;

  const eligible = !complete && daysUntil === 0 && resultsMet;

  return {
    name: tier2Name(), total_usd: tier2TotalUsd(), parts: ladder.length, part_min_days: tier2PartMinDays(), term_months: tier2TermMonths(),
    is_founding: isFounding,
    parts_completed: partsCompleted, complete,
    current_part_number: currentPart ? currentPart.n : null,
    current_part_base_usd: base,
    discount_pct: discountRate, discount_perpetual: perpetual,
    current_part_net_usd: net,
    paid_usd: paidUsd,
    next_part_eligible: eligible,
    days_until_next_part: daysUntil,
    results_gate_met: resultsMet,
    reason: complete ? "Tier 2 complete — all parts purchased." : (eligible ? "Ready to buy the next part." : (gateReason || "Not eligible yet.")),
    ladder,
  };
}
