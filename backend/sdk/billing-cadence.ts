// billing-cadence.ts — 13 four-week billing periods a year (52 weeks ÷ 4 = 13, one more than 12 months).
//
// WHY: billing every four weeks means 13 periods a year, not 12. When a tier's price is defined as a four-week
// rate (Tier 1 = $1,000 / 4 weeks), a full year is 13 × that rate = $13,000 — the "13th period" is +8.33% versus
// a 12-month year (13/12 − 1). This module exposes that factor so the ANNUAL price is computed as 13 four-week
// periods when the cadence is on.
//
// KEEP-2× BY DESIGN: the factor is applied at the PRICE SOURCE (each tier's price getter), and the value stacks
// compute their target as price × multiple — so the delivered advertising value scales up with the price and the
// "~2×" headline holds ($13k → ~$26k, $216,666.67 → ~$433k).
//
// COMPLIANCE / DISCLOSURE: this must be presented as "billed in 13 four-week cycles" (or "every 4 weeks"), NEVER
// as "monthly" — implying monthly while collecting 13 periods is the deceptive pattern to avoid. It is a real
// (small) price increase; disclose the annual total and the four-week cadence up front. Prepay-upfront is
// unchanged: the full 13-period year is still collected once, not billed per cycle. Not legal advice.
import { snapBool, snapNumber } from "./settings.ts";

/** Turn 13-period (four-week) annual pricing on. ON by default per owner decision. Off → annual = 12-month price. */
export const billing13PeriodPricingEnabled = () => snapBool("BILLING_13_PERIOD_PRICING", true);

/** Four-week periods in a year (13). Shares the BILLING_CYCLES setting so cadence and cycle count stay in lockstep. */
export const billingPeriodsPerYear = () => Math.max(1, Math.round(snapNumber("BILLING_CYCLES", 13)));

/** Multiplier on a tier's annual price when 13-period pricing is on: periods ÷ 12 (13/12 ≈ 1.0833, i.e. +8.33%).
 *  1.0 when off. Applied once, at each tier's price getter, so everything downstream (value-stack target, delivery
 *  guarantee basis, signup charge, billing schedule) uses the same 13-period annual and the value ratio is kept. */
export const billingYearFactor = () => billing13PeriodPricingEnabled() ? (billingPeriodsPerYear() / 12) : 1;
