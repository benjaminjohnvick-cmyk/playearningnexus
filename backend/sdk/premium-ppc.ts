// Premium PPC — closed-loop POINTS engine (shared config + helpers).
//
// MODEL (per matched advertiser⇄user pair) — NO-PENALTY / EARN-AS-YOU-GO:
//   • An advertiser pays PPC_GRID_ANNUAL_PRICE (default $5,000) for a year of PPC AdGrid.
//   • Premium PPC users are matched 1:1 to advertisers (N advertisers ⇒ at most N premium users).
//   • A matched user EARNS points by staying active — up to DAILY_EARN_CAP ($4) of point value per
//     active day, capped at ANNUAL_POINTS_CEILING ($1,460) for the year.
//   • Points are CLOSED-LOOP: EARNED (never purchased), redeemable only in the catalog, and are
//     non-cashable and non-transferable.
//   • >>> A MISSED DAY COSTS THE USER NOTHING. <<< There is no upfront advance to repay, no card
//     charge, no debt, no "points owed", and no referral quota. If a user is inactive on a given
//     day they simply do not earn that day's points — that is the entire consequence.
//   • Advertiser rewards (refund store credit / social credit) are tied to activity actually
//     delivered (pay-for-performance), so when a user under-earns there is simply less to fund —
//     nothing is ever clawed back from anyone.
//
// This removes the three regulated triggers at once: no money advanced or collected
// (consumer-credit / lending), earned closed-loop points (money transmission), and no required
// recruitment (pyramid / chain-referral). It is a STRUCTURAL change to reduce legal risk — it is
// NOT legal advice or a compliance sign-off.

import { snapNumber } from "./settings.ts";
export const PPC_GRID_ANNUAL_PRICE = Number(Deno.env.get("PPC_GRID_ANNUAL_PRICE") ?? "5000");

// The most a matched user can EARN in point value over the year ($1,460). This is an EARNING
// CEILING — not a fee, not an advance, not a debt. (Env kept back-compatible with the old name.)
export const ANNUAL_POINTS_CEILING = Number(
  Deno.env.get("PREMIUM_ANNUAL_POINTS_CEILING") ?? Deno.env.get("PREMIUM_ADVANCE_AMOUNT") ?? "1460",
);

// The most point value a user can earn on a single active day ($4).
export const DAILY_EARN_CAP = Number(
  Deno.env.get("PREMIUM_DAILY_EARN_CAP") ?? Deno.env.get("PREMIUM_DAILY_MIN_EARN") ?? "4",
);

// Advertiser-side, pay-for-performance (granted as the user is active, tied to delivered activity):
//   • BUSINESS_REFUND_PER_DAY ($4): store credit to the matched advertiser per active day.
//   • SOCIAL_CREDIT_PER_DAY ($32): free social-media ad credit per active day, until the advertiser
//     has DOUBLED their investment (received DOUBLING_MULTIPLE × grid in fulfilled orders).
export const BUSINESS_REFUND_PER_DAY = Number(Deno.env.get("PREMIUM_BUSINESS_REFUND_PER_DAY") ?? "4");
export const SOCIAL_CREDIT_PER_DAY = Number(Deno.env.get("PREMIUM_SOCIAL_CREDIT_PER_DAY") ?? "32");
export const DOUBLING_MULTIPLE = Number(Deno.env.get("PREMIUM_DOUBLING_MULTIPLE") ?? "2");

/** The most a user can EARN in point value over the year ($1,460). Not a debt. */
export const annualEarnCeiling = () => round2(snapNumber("PREMIUM_ANNUAL_POINTS_CEILING", ANNUAL_POINTS_CEILING));
/** Order value at which the advertiser has "doubled" and free social/ads stop ($10,000). */
export const gridAnnualPrice = () => snapNumber("PPC_GRID_ANNUAL_PRICE", PPC_GRID_ANNUAL_PRICE);
export const dailyEarnCap = () => snapNumber("PREMIUM_DAILY_EARN_CAP", DAILY_EARN_CAP);
export const businessRefundPerDay = () => snapNumber("PREMIUM_BUSINESS_REFUND_PER_DAY", BUSINESS_REFUND_PER_DAY);
export const socialCreditPerDay = () => snapNumber("PREMIUM_SOCIAL_CREDIT_PER_DAY", SOCIAL_CREDIT_PER_DAY);
export const doublingTarget = () => round2(gridAnnualPrice() * snapNumber("PREMIUM_DOUBLING_MULTIPLE", DOUBLING_MULTIPLE));
/** Has the advertiser doubled their investment? (received ≥ $10,000 in fulfilled orders.) */
export function hasDoubled(ordersValueDelivered?: number): boolean {
  return round2(ordersValueDelivered ?? 0) >= doublingTarget();
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** UTC calendar day (YYYY-MM-DD) for "was the user active today" checks. */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// --- Back-compat stubs -------------------------------------------------------------------------
// These names existed in the old advance/charge model. They are kept ONLY so any lingering importer
// still resolves cleanly; every one is now a no-op that can never charge a card or create a debt.
export const MISSED_DAY_CHARGE = 0;
export const DAILY_MIN_EARN = DAILY_EARN_CAP;
export const PREMIUM_ADVANCE_AMOUNT = ANNUAL_POINTS_CEILING;
/** @deprecated There is no advance; returns the annual EARN ceiling for legacy callers. */
export const advanceLimit = () => annualEarnCeiling();
/** @deprecated The platform keeps nothing from a missed day — there is no missed-day charge. */
export const platformKeepPerDay = () => 0;
/** @deprecated Live charges are unused in the no-penalty model. */
export function liveChargesEnabled(): boolean {
  return (Deno.env.get("PREMIUM_PPC_LIVE_CHARGES") ?? "0") === "1";
}

export type ChargeResult = { ok: false; simulated: true; amount: number; error: string };
/**
 * @deprecated DISABLED in the no-penalty model. Never charges a card and never touches Stripe.
 * Kept only so any legacy import resolves; always returns a harmless no-op result.
 */
export function chargeSavedCardOffSession(_opts?: unknown): Promise<ChargeResult> {
  return Promise.resolve({ ok: false, simulated: true, amount: 0, error: "charges disabled (no-penalty model)" });
}
