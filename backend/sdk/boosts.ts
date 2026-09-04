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

// Purchase-linked STACKING boost knobs.
export const purchaseBoostStackEnabled = () => snapBool("PURCHASE_BOOST_STACK_ENABLED", true);
export const purchaseBoostStep = () => Math.max(0, snapNumber("PURCHASE_BOOST_STEP", 0.5));
export const purchaseBoostMax = () => Math.min(5, Math.max(1, snapNumber("PURCHASE_BOOST_MAX", 3)));

/** Grant or RAISE the caller's active earn-boost on a sink purchase. First purchase starts at the base
 *  multiplier; each further purchase (while a boost is active) adds PURCHASE_BOOST_STEP up to PURCHASE_BOOST_MAX,
 *  and every purchase refreshes the window to now + EARN_BOOST_HOURS. Returns the new multiplier (1 if disabled).
 *  Idempotent-safe enough for our use: a rare double-call just bumps twice, still capped by the ceiling. */
export async function bumpEarnBoostOnPurchase(userId: string): Promise<number> {
  if (!purchaseBoostStackEnabled() || !earnBoostEnabled() || !userId) return await activeBoostMultiplier(userId);
  const now = Date.now();
  const hours = earnBoostHours();
  const expires = new Date(now + hours * 3_600_000).toISOString();
  const base = earnBoostMultiplier();
  const step = purchaseBoostStep();
  const max = purchaseBoostMax();

  const rows = await db.filter("EarnBoost", { user_id: String(userId) }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
  const active = (rows || []).find((r) => (Date.parse(String(r.expires_at || "")) || 0) > now);
  if (active) {
    const next = Math.min(max, (Number(active.multiplier) || base) + step);
    await db.update("EarnBoost", String(active.id), { multiplier: next, hours, expires_at: expires, stacked: true }).catch(() => null);
    return next;
  }
  const startMult = Math.min(max, base);
  await db.create("EarnBoost", {
    user_id: String(userId), multiplier: startMult, hours, price_usd: 0,
    activated_at: new Date(now).toISOString(), expires_at: expires, source: "purchase_linked",
  }).catch(() => null);
  return startMult;
}

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
