// Welcome Rewards — a non-cashable promotional discount credit granted once per user at signup.
//
// Applied ONLY to PLATFORM catalog + store items (the platform is the seller), so the cost is a
// discount on the platform's own margin — never a subsidy paid to a third-party member seller. Bounded
// by a per-order cap (WELCOME_REWARDS_MAX_PCT) and a 12-month expiry, which is what keeps the headline
// "$1,460" honest and cheap (breakage + cap). Denominated in USD; a points discount decrements the pool
// by the dollar-equivalent (1 point = 1¢).

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";

export interface WelcomeCredit { remaining_usd: number; expires_at: string | null; expired: boolean; }

const nowISO = () => new Date().toISOString();

/** Lazily grant the welcome pool on first touch, and return the current (non-expired) balance. */
export async function ensureWelcomeCredit(userId: string): Promise<WelcomeCredit> {
  const user = await db.get("User", userId).catch(() => null) as any;
  if (!user) return { remaining_usd: 0, expires_at: null, expired: true };

  if (!user.welcome_credit_granted) {
    const total = Math.max(0, await getNumber("WELCOME_REWARDS_TOTAL", 1460));
    const days = Math.max(0, await getNumber("WELCOME_REWARDS_EXPIRY_DAYS", 365));
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    await db.update("User", userId, {
      welcome_credit_granted: true, welcome_credit_usd: total, welcome_credit_expires: expires, welcome_credit_granted_at: nowISO(),
    }).catch(() => null);
    return { remaining_usd: total, expires_at: expires, expired: false };
  }

  const remaining = Number(user.welcome_credit_usd) || 0;
  const expires = user.welcome_credit_expires || null;
  const expired = !!expires && new Date(expires).getTime() < Date.now();
  return { remaining_usd: expired ? 0 : remaining, expires_at: expires, expired };
}

/** Discount available on one order (USD), capped at WELCOME_REWARDS_MAX_PCT of the order and the pool. */
export async function welcomeDiscountFor(userId: string, orderUsd: number): Promise<number> {
  const c = await ensureWelcomeCredit(userId);
  if (c.expired || c.remaining_usd <= 0 || !(orderUsd > 0)) return 0;
  const pct = Math.min(1, Math.max(0, await getNumber("WELCOME_REWARDS_MAX_PCT", 0.20)));
  const cap = Math.round(orderUsd * pct * 100) / 100;
  return Math.min(cap, c.remaining_usd);
}

/** Deduct a used discount from the pool (call only after the discount is actually applied).
 *  Atomic compare-and-set with retry so concurrent purchases can't double-spend the promo pool. */
export async function redeemWelcomeCredit(userId: string, usedUsd: number): Promise<boolean> {
  if (!(usedUsd > 0)) return true;
  for (let attempt = 0; attempt < 4; attempt++) {
    const user = await db.get("User", userId).catch(() => null) as any;
    if (!user) return false;
    const remaining = Number(user.welcome_credit_usd) || 0;
    const next = Math.max(0, Math.round((remaining - usedUsd) * 100) / 100);
    // CAS: only write if the pool is still what we read (updateIf compares the current field value).
    const ok = await db.updateIf("User", userId, { welcome_credit_usd: next }, { field: "welcome_credit_usd", equals: remaining }).catch(() => false);
    if (ok) return true;
  }
  return false; // lost the race repeatedly — better to under-deduct than to block the sale we already made
}
