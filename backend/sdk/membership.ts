// Premium membership + points valuation.
//
// TWO SEPARATE TIERS (they are NOT the same thing):
//   • Premium MEMBERSHIP — for EVERY user. Auto-activates once the account is >= 1 day old. Costs a
//     $1/day fee that is deducted ONLY from that day's earnings — never a card, never a debt. If a
//     user earns less than $1 on a day, only what they earned is taken; nothing is carried forward.
//     A user who earns $0 that day pays $0. Cancel/opt-out is always honored.
//   • Premium PPC NETWORK — a SEPARATE program, capped 1:1 to businesses that paid the grid price
//     (see ppcNetworkCapacity + premium-ppc.ts). Being a paying-network user is not the same as
//     having a premium membership.
//
// POINTS VALUATION: points are worth POINT_VALUE_CENTS (1¢) each, like Swagbucks — but they are
// NON-CASHABLE: redeemable ONLY inside the catalog (closed-loop). Keeping points non-cashable is
// what preserves the money-transmitter protection, so POINTS_CASHABLE stays OFF by default.

import { snapNumber, snapBool } from "./settings.ts";
export const MEMBERSHIP_DAILY_FEE = Number(Deno.env.get("MEMBERSHIP_DAILY_FEE") ?? "1");            // $/day
export const MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS = Number(Deno.env.get("MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS") ?? "1");
export const POINT_VALUE_CENTS = Number(Deno.env.get("POINT_VALUE_CENTS") ?? "1");                  // 1¢ per point
export const POINTS_CASHABLE = (Deno.env.get("POINTS_CASHABLE") ?? "0") === "1";                    // OFF — closed-loop
/** Live, admin-adjustable (kept OFF unless legal clears it). */
export function pointsCashable(): boolean { return snapBool("POINTS_CASHABLE", POINTS_CASHABLE); }

export function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }
export function utcDay(d: Date = new Date()): string { return d.toISOString().slice(0, 10); }

/** Dollar value of a points balance (for CATALOG DISPLAY only — points are non-cashable). */
export function pointsToUsd(points: number): number {
  const cents = snapNumber("POINT_VALUE_CENTS", POINT_VALUE_CENTS);
  return round2(((Number(points) || 0) * cents) / 100);
}
/** Points needed to cover a dollar catalog price. */
export function usdToPoints(usd: number): number {
  const cents = snapNumber("POINT_VALUE_CENTS", POINT_VALUE_CENTS);
  return Math.ceil(((Number(usd) || 0) * 100) / cents);
}

/** Account age in whole days (used for the after-1-day auto-upgrade). */
export function accountAgeDays(user: Record<string, unknown>): number {
  const created = user.created_date ?? user.created_at ?? user.enrolled_at;
  if (!created) return 0;
  const ms = Date.now() - new Date(String(created)).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
