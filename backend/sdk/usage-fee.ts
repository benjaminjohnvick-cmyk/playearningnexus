// usage-fee.ts — the UNIFORM daily platform-usage fee, charged from EARNINGS only.
//
// A small daily fee (default $0.80) that applies to ALL users the same way — it is NOT tied to any payment
// method, so it is not a PayPal/card surcharge (PayPal's user agreement forbids surcharging for using PayPal;
// a uniform usage fee is outside that rule). Two hard consumer-protection rules are built into the math and
// must never be relaxed:
//   1) NO DEBT. The fee is deducted ONLY from a user's already-EARNED rewards. If they haven't earned it, the
//      fee simply does not accrue — a user can never owe money for using the site. It can never push a balance
//      negative and never creates a collectible obligation.
//   2) HONEST NET. The fee is disclosed, and the platform surfaces the ONE extra advertiser-funded survey that
//      offsets it, so a user still NETS their target daily earnings (e.g. $4/day). Earnings claims must be
//      stated NET of this fee — never advertise a gross figure the fee quietly reduces.
// The fee also stops at a lifetime/period CAP (default $182). Everything here is gated OFF by default pending
// counsel; the applying function moves nothing while disabled.
//
// COMPLIANCE NOTE: this fee is deliberately DECOUPLED from Buy-Now-Pay-Later. Charging a fee only when a user
// picks BNPL — or rebating the fee to everyone EXCEPT BNPL users — is a disguised BNPL surcharge and violates
// PayPal's terms. Keep this uniform. See BNPL-AND-USAGE-FEE-LEGAL-BRIEF.md.

import { snapBool, snapNumber } from "./settings.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ── Config (OFF / conservative by default — PENDING COUNSEL) ────────────────────────────────────────────
export const usageFeeEnabled = () => snapBool("USAGE_FEE_ENABLED", false);
/** Daily fee in CENTS (default 100 = $1.00). */
export const usageFeeDailyUsd = () => Math.max(0, snapNumber("USAGE_FEE_DAILY_CENTS", 100)) / 100;
/** Period cap in dollars (default $365 ≈ $1/day for a year). Fee stops once a user has paid this much. */
export const usageFeeCapUsd = () => Math.max(0, snapNumber("USAGE_FEE_CAP_USD", 365));
/** Cap window in days (default 365 = rolling year). 0 = lifetime (never resets). */
export const usageFeeCapPeriodDays = () => Math.max(0, Math.round(snapNumber("USAGE_FEE_CAP_PERIOD_DAYS", 365)));
/** Show the "do one more survey to offset today's fee" nudge. */
export const usageFeeOffsetEnabled = () => snapBool("USAGE_FEE_OFFSET_ENABLED", true);
/** Assumed net value of one extra survey, for the offset count (default $1.00 → one survey offsets the $1/day). */
export const usageFeePerSurveyUsd = () => Math.max(0.01, snapNumber("USAGE_FEE_PER_SURVEY_USD", 1.0));

// ── Pure core (unit-tested) ─────────────────────────────────────────────────────────────────────────────
export interface UsageFeeInput {
  feeUsd: number;              // the day's fee (e.g. 0.80)
  earnedAvailableUsd: number;  // the user's CURRENTLY-AVAILABLE earned rewards (never deduct more than this)
  paidToDateUsd: number;       // fee already paid within the current cap window
  capUsd: number;              // the cap ceiling
}
export interface UsageFeeResult { fee: number; reason: string; cap_remaining: number; }

/** Compute the fee actually chargeable today. NEVER exceeds available earnings (no debt) and NEVER exceeds the
 *  remaining cap. Returns 0 with a reason when nothing should be charged. Pure + deterministic. */
export function computeUsageFee(i: UsageFeeInput): UsageFeeResult {
  const capRemaining = round2(Math.max(0, (Number(i.capUsd) || 0) - (Number(i.paidToDateUsd) || 0)));
  const want = Math.max(0, round2(Number(i.feeUsd) || 0));
  const available = Math.max(0, round2(Number(i.earnedAvailableUsd) || 0));
  if (want <= 0) return { fee: 0, reason: "no fee configured", cap_remaining: capRemaining };
  if (capRemaining <= 0) return { fee: 0, reason: "cap reached — fee no longer applies", cap_remaining: 0 };
  if (available <= 0) return { fee: 0, reason: "no earnings to draw from — no fee charged (never a debt)", cap_remaining: capRemaining };
  const fee = round2(Math.min(want, available, capRemaining));
  return { fee, reason: "charged from available earnings", cap_remaining: round2(capRemaining - fee) };
}

/** How many extra surveys offset a given fee so the user nets the same. Pure. */
export function surveysToOffset(feeUsd: number, perSurveyUsd: number): number {
  const f = Math.max(0, Number(feeUsd) || 0);
  const p = Math.max(0.01, Number(perSurveyUsd) || 0.01);
  return f <= 0 ? 0 : Math.ceil(f / p);
}

/** Short, honest disclosure line for the fee (surfaced at signup + in earnings views). Pure. */
export function usageFeeDisclosure(feeUsd: number, capUsd: number, targetNetDailyUsd = 4): string {
  return `A ${usd(feeUsd)}/day platform usage fee is deducted from your earned rewards (never billed to you and ` +
    `never a debt — if you haven't earned it, it isn't charged), up to ${usd(capUsd)} total. Complete one extra ` +
    `survey to offset it and still net about ${usd(targetNetDailyUsd)}/day.`;
}
function usd(n: number): string { const v = Number(n) || 0; return "$" + (Number.isInteger(v) ? String(v) : v.toFixed(2)); }
