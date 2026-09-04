// boosts.ts — closed-loop Site-Cash EARN BOOSTS. A user spends non-cashable Site Cash to activate a
// TIME-LIMITED earn multiplier (e.g. 2× Site-Cash earnings for 24h). It is DETERMINISTIC — a fixed multiplier
// for a fixed window, bought at a known price. It is NOT a random/paid draw, so it is not a loot box and not
// gambling. The purchase is a closed-loop Site-Cash SINK (booked as `breakage`); the boost only ever scales
// NON-CASHABLE Site-Cash earnings, never a cash payout. This module is pure config + math; the active-boost
// lookup reads EarnBoost rows and honors expiry at read time.
import { snapBool, snapNumber } from "./settings.ts";
import { db } from "./db.ts";

export const earnBoostEnabled = () => snapBool("EARN_BOOST_ENABLED", true);
export const earnBoostMultiplier = () => Math.min(5, Math.max(1, snapNumber("EARN_BOOST_MULTIPLIER", 2)));
export const earnBoostHours = () => Math.min(168, Math.max(1, snapNumber("EARN_BOOST_HOURS", 24)));
export const earnBoostPriceUsd = () => Math.max(0, Math.round((snapNumber("EARN_BOOST_PRICE_USD", 5)) * 100) / 100);

/** The caller's currently-active boost multiplier (>1) if a non-expired EarnBoost exists, else 1 (no boost). */
export async function activeBoostMultiplier(userId: string): Promise<number> {
  if (!earnBoostEnabled() || !userId) return 1;
  const now = Date.now();
  const rows = await db.filter("EarnBoost", { user_id: String(userId) }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
  for (const r of rows || []) {
    const exp = Date.parse(String(r.expires_at || "")) || 0;
    if (exp > now) return Math.min(5, Math.max(1, Number(r.multiplier) || earnBoostMultiplier()));
  }
  return 1;
}

/** Apply the caller's active boost to a base Site-Cash earning. Returns the boosted amount (rounded to cents). */
export async function applyEarnBoost(userId: string, baseUsd: number): Promise<number> {
  const mult = await activeBoostMultiplier(userId);
  return Math.round((Math.max(0, Number(baseUsd) || 0) * mult) * 100) / 100;
}
