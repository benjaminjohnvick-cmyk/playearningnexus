// endorser-rewards.ts — the pure, compliant core of the opt-in paid-endorser ("Amplify") program: members
// who connect their own social accounts and post the platform's AI-personalized ads earn Site Cash for the
// posts that ACTUALLY CONVERT — a share of the measured conversion value, not a flat per-post payment.
//
// Why performance-based: paying for measured outcomes (not volume) removes the incentive to spam, which is
// what gets accounts and API access banned. Guardrails baked in here:
//   • DISCLOSURE REQUIRED — a post that isn't #ad/sponsored-disclosed earns nothing (FTC: paid endorsers
//     must disclose, and the platform is responsible for enforcing it).
//   • SELF-CONVERSION EXCLUDED — a member can't convert on their own post to farm rewards.
//   • DAILY + PERIOD CAPS — bound per-member payout so one member can't drain the budget.
//   • VALUE, NEVER GUARANTEED — the reward is a share of REAL measured value; the platform never promises an
//     income figure.
// The whole program is OFF by default (ENDORSER_ENABLED) pending counsel. Pure/deterministic; the functions
// do the crediting via the platform's balance + ledger primitives.

import { snapBool, snapNumber } from "./settings.ts";

export const endorserEnabled = () => snapBool("ENDORSER_ENABLED", false);
export const endorserRewardSharePct = () => Math.min(1, Math.max(0, snapNumber("ENDORSER_REWARD_SHARE_PCT", 0.2)));
export const endorserMinConversionUsd = () => Math.max(0, snapNumber("ENDORSER_MIN_CONVERSION_USD", 1));
export const endorserDailyCapUsd = () => Math.max(0, snapNumber("ENDORSER_DAILY_CAP_USD", 25));
export const endorserPeriodCapUsd = () => Math.max(0, snapNumber("ENDORSER_PERIOD_CAP_USD", 500));
/** Whether Site Cash endorser rewards are treated as 1099-reportable. Default ON (conservative) — CONFIRM
 *  WITH COUNSEL for non-cashable closed-loop credit. */
export const endorserReward1099Reportable = () => snapBool("ENDORSER_REWARD_1099_REPORTABLE", true);

function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }

export interface ConversionInput {
  conversion_value_usd: number;   // measured value of the conversion this member's post produced
  disclosed: boolean;             // was the post #ad / sponsored-disclosed?
  self_conversion?: boolean;      // did the converting user == the poster? (farming guard)
  already_rewarded?: boolean;     // idempotency
}

/** The GROSS reward a conversion earns, before caps: a share of the measured conversion value — but ZERO
 *  unless the post was disclosed and the conversion is legitimate. Pure. */
export function endorserRewardFor(i: ConversionInput, sharePct = endorserRewardSharePct(), minUsd = endorserMinConversionUsd()): { reward: number; ok: boolean; reason: string } {
  if (i.already_rewarded) return { reward: 0, ok: false, reason: "already rewarded" };
  if (!i.disclosed) return { reward: 0, ok: false, reason: "post not #ad-disclosed — no reward (disclosure is required)" };
  if (i.self_conversion) return { reward: 0, ok: false, reason: "self-conversion — excluded" };
  const v = Number(i.conversion_value_usd) || 0;
  if (v < minUsd) return { reward: 0, ok: false, reason: `conversion below the $${minUsd} minimum` };
  return { reward: round2(v * sharePct), ok: true, reason: "eligible" };
}

/** Apply the per-member DAILY and PERIOD caps to a gross reward, given how much is left in each. The reward
 *  is clamped to the smaller remaining headroom. Pure. */
export function capReward(gross: number, remainingDailyUsd: number, remainingPeriodUsd: number): { paid: number; capped: boolean; reason: string } {
  const g = Math.max(0, Number(gross) || 0);
  const room = Math.max(0, Math.min(remainingDailyUsd, remainingPeriodUsd));
  const paid = round2(Math.min(g, room));
  const capped = paid < g;
  return { paid, capped, reason: capped ? (remainingDailyUsd <= remainingPeriodUsd ? "daily cap reached" : "period cap reached") : "within caps" };
}

/** Remaining headroom under a cap given what's already been paid this window. Pure. */
export function remaining(capUsd: number, paidThisWindowUsd: number): number {
  if (capUsd <= 0) return Number.POSITIVE_INFINITY;   // 0 = no cap
  return Math.max(0, capUsd - Math.max(0, paidThisWindowUsd));
}
