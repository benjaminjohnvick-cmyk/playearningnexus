// earn-back.ts — the Prepay & Earn-Back Discount guardrails.
//
// Model: a member pays for an item UPFRONT (the item price + a "portion" equal to the discount they choose
// to earn back), then earns that portion back over time by completing surveys. Because they pay first and
// earn back their OWN activity, no credit is extended and there's no default — it's a REBATE, not a loan.
// "Ownership %" is a non-tradeable progress label, so it's not a security either. See
// PREPAY-EARNBACK-DISCOUNT.md for the full decision record.
//
// This module holds the guardrails layered on top of earn-rate.ts's minutes/percent math:
//   • per-item discount cap (reuses BUYER_MAX_DISCOUNT_PCT)
//   • premium monthly discount cap (per member)
//   • global monthly kill-switch (total premium subsidy across all members)
//   • grace / skip days and attempt-based daily eligibility
//   • founding-vs-sustainable premium price
//   • unearned-portion → non-expiring Site Cash on abandon
//
// Nothing here converts Site Cash to bank cash. Earn-back only ever becomes a discount on the member's own
// purchase, or (on abandon) closed-loop Site Cash — never a payout.

import { db } from "./db.ts";
import { snapNumber, snapBool, snapString } from "./settings.ts";
import { buyerMaxDiscountPct } from "./earn-rate.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Feature flag. */
export const earnBackEnabled = () => snapBool("EARNBACK_ENABLED", true);

/** Per-item cap on the discount a member may earn back (percent, e.g. 50). Shared with the checkout split. */
export const earnBackMaxItemPct = () => buyerMaxDiscountPct();

/** Premium member's monthly earn-back discount cap in USD. */
export const premiumMonthlyCapUsd = () => Math.max(0, snapNumber("EARNBACK_PREMIUM_MONTHLY_CAP_USD", 100));

/** Global monthly kill-switch: total premium discount across ALL members. 0 = no ceiling. */
export const globalMonthlyCapUsd = () => Math.max(0, snapNumber("EARNBACK_GLOBAL_MONTHLY_CAP_USD", 1000));

/** Grace / skip days a member gets per month before earning pauses. */
export const graceDaysPerMonth = () => Math.max(0, Math.round(snapNumber("EARNBACK_GRACE_DAYS_PER_MONTH", 3)));

/** Minutes of genuine ATTEMPT that count a day as active (attempt-based, not completion). */
export const dailyAttemptMinutes = () => Math.max(0, snapNumber("EARNBACK_DAILY_ATTEMPT_MINUTES", 1));

/** The month key (YYYY-MM) a timestamp falls in — used to scope monthly caps and grace counters. */
export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** The day key (YYYY-MM-DD). */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ---- Premium pricing: founding loss-leader → sustainable, with grandfather conversion -----------------

export interface PremiumPricing {
  price_usd: number;         // price to charge THIS member right now
  founding_price_usd: number;
  after_price_usd: number;
  founding: boolean;         // is the founding window still open for new signups?
  window_days: number;
  launch_date: string;       // YYYY-MM-DD or ""
}

/** Founding-window state + the price a member should pay.
 *  - New signups within the window get the founding price; after the window they get the after price.
 *  - A `memberJoinedFounding` member keeps founding UNTIL their next renewal (grandfather converts): pass
 *    `renewing = true` at renewal time to roll them to the after price. */
export function premiumPricing(opts: { now?: Date; memberJoinedFounding?: boolean; renewing?: boolean } = {}): PremiumPricing {
  const founding_price_usd = round2(snapNumber("EARNBACK_PREMIUM_PRICE_USD", 9.99));
  const after_price_usd = round2(snapNumber("EARNBACK_PREMIUM_PRICE_AFTER_USD", 19.99));
  const window_days = Math.max(0, Math.round(snapNumber("EARNBACK_FOUNDING_WINDOW_DAYS", 90)));
  const launch_date = snapString("EARNBACK_LAUNCH_DATE", "");

  let founding = true;
  if (launch_date) {
    const start = new Date(`${launch_date}T00:00:00Z`).getTime();
    const now = (opts.now ?? new Date()).getTime();
    if (Number.isFinite(start)) {
      const days = (now - start) / 86_400_000;
      founding = days <= window_days;
    }
  }

  // A founding member keeps the founding price until they renew; a renewal rolls them to the after price.
  let price_usd = after_price_usd;
  if (opts.memberJoinedFounding) price_usd = opts.renewing ? after_price_usd : founding_price_usd;
  else price_usd = founding ? founding_price_usd : after_price_usd;

  return { price_usd, founding_price_usd, after_price_usd, founding, window_days, launch_date };
}

// ---- Monthly subsidy accounting (premium only) --------------------------------------------------------

/** Sum of a premium member's earn-back discount CREDITED this month (from their active/finished plans). */
export async function memberMonthlyEarned(userId: string, mKey: string = monthKey()): Promise<number> {
  const rows = await db.filter("EarnBackPlan", { user_id: userId, month: mKey }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
  let sum = 0;
  for (const p of rows || []) sum += Number(p.earned_this_month_usd) || 0;
  return round2(sum);
}

/** Total premium earn-back discount issued across ALL members this month (for the kill-switch). Tracked on
 *  a single GlobalSettings-style counter row in EarnBackLedger to avoid scanning every plan. */
export async function globalMonthlyIssued(mKey: string = monthKey()): Promise<number> {
  const rows = await db.filter("EarnBackLedger", { month: mKey }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  return round2(Number(rows?.[0]?.premium_issued_usd) || 0);
}

/** Remaining premium subsidy headroom right now: min(member's monthly remaining, global remaining). Returns
 *  Infinity for whichever ceiling is set to 0 (disabled). */
export async function premiumHeadroomUsd(userId: string, mKey: string = monthKey()): Promise<{ member: number; global: number; allowed: number }> {
  const memCap = premiumMonthlyCapUsd();
  const gblCap = globalMonthlyCapUsd();
  const memberRem = memCap > 0 ? Math.max(0, memCap - (await memberMonthlyEarned(userId, mKey))) : Infinity;
  const globalRem = gblCap > 0 ? Math.max(0, gblCap - (await globalMonthlyIssued(mKey))) : Infinity;
  return { member: memberRem, global: globalRem, allowed: Math.min(memberRem, globalRem) };
}

/** Record premium discount issued this month against the global kill-switch counter (atomic-ish upsert). */
export async function addGlobalIssued(amountUsd: number, mKey: string = monthKey()): Promise<void> {
  const amt = round2(Math.max(0, Number(amountUsd) || 0));
  if (amt <= 0) return;
  for (let i = 0; i < 6; i++) {
    const rows = await db.filter("EarnBackLedger", { month: mKey }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const row = rows?.[0];
    if (row) {
      const cur = Number(row.premium_issued_usd) || 0;
      const ok = await db.update("EarnBackLedger", row.id as string, { premium_issued_usd: round2(cur + amt), month: mKey }).catch(() => null);
      if (ok) return;
    } else {
      const created = await db.create("EarnBackLedger", { month: mKey, premium_issued_usd: amt }).catch(() => null);
      if (created) return;
    }
  }
}

// ---- Daily eligibility + grace ------------------------------------------------------------------------

export interface EligibilityState {
  active_today: boolean;    // has the member met the attempt requirement today?
  grace_used: number;       // grace days spent this month
  grace_total: number;
  grace_left: number;
  paused: boolean;          // earning is paused (grace exhausted AND not active today)
}

/** Given a plan's per-month grace usage and whether the member attended today, compute eligibility.
 *  Pausing NEVER claws back banked discount — it only stops NEW earning until they resume. */
export function eligibility(opts: { activeToday: boolean; graceUsed: number }): EligibilityState {
  const total = graceDaysPerMonth();
  const used = Math.max(0, Math.round(opts.graceUsed) || 0);
  const left = Math.max(0, total - used);
  // If they attended today, they're eligible. If not, they're eligible only while grace remains.
  const paused = !opts.activeToday && left <= 0;
  return { active_today: !!opts.activeToday, grace_used: used, grace_total: total, grace_left: left, paused };
}

/** The unearned portion of a plan that converts to Site Cash when a member abandons the item. */
export function unearnedPortionUsd(plan: { portion_prepaid_usd?: number; earned_usd?: number }): number {
  const prepaid = Math.max(0, Number(plan.portion_prepaid_usd) || 0);
  const earned = Math.max(0, Number(plan.earned_usd) || 0);
  return round2(Math.max(0, prepaid - earned));
}
