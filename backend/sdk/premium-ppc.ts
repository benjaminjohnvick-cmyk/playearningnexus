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
import { db } from "./db.ts";
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

// ── UP-FRONT GRANT MODE (optional) ──────────────────────────────────────────────────────────────
// When PREMIUM_UPFRONT_GRANT is on, enrollment grants the FULL annual ceiling ($1,460 in closed-loop,
// non-cashable points) UP FRONT, banked in the member's balance, in exchange for a survey commitment
// (≈8 min/day for a year, fulfillable flexibly). NOTHING is ever repaid or clawed back — the ONLY
// consequence of falling behind is being locked out of the program (and needing lockout mode to
// re-enroll). This REVERSES the default earn-as-you-go safety posture; the toggle preserves both.
const snapNum = (k: string, d: number) => snapNumber(k, d);
export const upfrontGrantEnabled = () => snapNum("PREMIUM_UPFRONT_GRANT", 1) !== 0;
export const surveyCommitmentDays = () => Math.max(1, Math.round(snapNum("PREMIUM_SURVEY_COMMITMENT_DAYS", 365)));
export const surveyMinutesPerDay = () => Math.max(1, snapNum("PREMIUM_SURVEY_MINUTES_PER_DAY", 8));
export const surveyPaceGraceDays = () => Math.max(0, snapNum("PREMIUM_SURVEY_GRACE_DAYS", 7));
export const spentOutThresholdPct = () => Math.min(1, Math.max(0, snapNum("PREMIUM_SPENT_OUT_PCT", 0.05)));
/** Order value at which a matched advertiser's free social posting stops — i.e. they've DOUBLED their
 *  $5,000 (default $10,000). After this, their earnings are points spendable on anything via the site. */
export const socialPostingOrderTarget = () => round2(snapNum("PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD", 10000));
/** Advertised value of the free AI social advertising a paying advertiser receives (default $10,000). */
export const businessAdCreditUsd = () => round2(snapNum("PREMIUM_BUSINESS_AD_CREDIT_USD", 10000));
/** Convert a USD figure to its point equivalent at 1¢/point (advertise $ values; deliver points). */
export function usdToPoints(usd: number, cents = 1): number { return Math.round((Number(usd) || 0) * (100 / Math.max(1, cents))); }
export function socialPostingActive(ordersValueDelivered?: number): boolean {
  return round2(ordersValueDelivered ?? 0) < socialPostingOrderTarget();
}

/** Survey-commitment pace for an up-front member: expected vs. completed survey-days, and whether behind. */
export function commitmentPace(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): {
  days_elapsed: number; requirement: number; expected: number; done: number; behind_by: number; behind: boolean; complete: boolean;
} {
  const startMs = member?.commitment_start ? new Date(String(member.commitment_start)).getTime() : nowMs;
  const daysElapsed = Math.max(0, Math.floor((nowMs - startMs) / 86400000));
  const requirement = surveyCommitmentDays();
  const expected = Math.min(requirement, daysElapsed);
  const done = Math.max(0, Number(member?.survey_days) || 0);
  const behindBy = Math.max(0, expected - done);
  return { days_elapsed: daysElapsed, requirement, expected, done, behind_by: behindBy, behind: behindBy > surveyPaceGraceDays(), complete: done >= requirement };
}

/** Has the member spent (near) all of their granted points? (Heuristic: balance ≤ pct × grant.) */
export function isSpentOut(user: Record<string, unknown> | null | undefined, member: Record<string, unknown> | null | undefined): boolean {
  const grant = Number(member?.grant_points) || 0;
  if (grant <= 0) return false;
  const bal = Number(user?.current_balance) || 0;
  return bal <= grant * spentOutThresholdPct();
}

/** Default = spent-out AND behind on the survey pace → lock out (until a new slot opens). */
export function isDefaulted(user: Record<string, unknown> | null | undefined, member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!member || !member.upfront_grant) return false;
  return isSpentOut(user, member) && commitmentPace(member, nowMs).behind;
}

/** Mark that a member met their survey requirement TODAY (idempotent per UTC day). Callable server-side
 *  from the survey-completion flow. Returns the new count, or null if not in an active up-front term. */
export async function markSurveyDay(userId: string): Promise<{ survey_days: number; already: boolean } | null> {
  const rows = await db.filter("PremiumPPCMembership", { user_id: userId }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
  const m = rows.find((x) => x.status === "active" && x.upfront_grant) || null;
  if (!m) return null;
  const today = utcDay();
  if (m.last_survey_day === today) return { survey_days: Number(m.survey_days) || 0, already: true };
  const next = (Number(m.survey_days) || 0) + 1;
  await db.update("PremiumPPCMembership", String(m.id), { survey_days: next, last_survey_day: today }).catch(() => null);
  return { survey_days: next, already: false };
}

/** Attribute a delivered order's value toward a matched advertiser's "doubling" total (drives when their
 *  free advertising stops). Only counts when the seller is an active PPC advertiser. Best-effort. */
export async function creditAdvertiserOrder(sellerId: string, amountUsd: number): Promise<void> {
  if (!sellerId || !(Number(amountUsd) > 0)) return;
  const seller = await db.get("User", sellerId).catch(() => null) as Record<string, unknown> | null;
  if (!seller || !seller.ppc_grid_active) return;
  const cur = Number(seller.ppc_orders_value_delivered) || 0;
  await db.update("User", sellerId, { ppc_orders_value_delivered: round2(cur + Number(amountUsd)) }).catch(() => null);
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
