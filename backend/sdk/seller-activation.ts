// seller-activation.ts — the seller ⇄ user activation gate for closed-loop cash-back.
//
// A member seller earns 10% cash-back in NON-CASHABLE points on each sale. To USE those points the seller
// must sign up to use the site as a USER too — done in ONE CLICK during seller onboarding, agreeing to use
// the platform as both a seller AND a user for a year (SELLER_USER_COMMITMENT_MONTHS). Until they activate,
// the cash-back sits in a LOCKED bucket (`pending_cashback_points`) and can't be spent.
//
// This is a pure closed-loop mechanic, NOT money transmission: nothing is ever converted to cash. The gate
// simply keeps the earned scrip inside the loop — the seller can only realize it by using the site.

import { sellerUserCommitmentMonths } from "./revenue.ts";
import { db } from "./db.ts";

// The consent kind appended to the append-only ConsentRecord ledger when a seller one-click activates.
export const SELLER_USER_CONSENT_KIND = "seller_user_activation";

// The User fields this gate reads/writes (all live on the User JSONB `data` column — no migration):
//   seller_user_activated        boolean  — the seller has activated user membership
//   seller_user_activated_at     ISO      — when
//   seller_user_commitment_until ISO      — end of the agreed seller+user term
//   seller_user_commitment_months number  — the term length captured at activation
//   pending_cashback_points      number   — LOCKED cash-back awaiting activation

/** Has this seller activated user membership (so cash-back is spendable)? */
export function isSellerActivated(user: Record<string, unknown> | null | undefined): boolean {
  return !!user && user.seller_user_activated === true;
}

/** Locked cash-back points currently held for a seller (awaiting one-click activation). */
export function pendingCashbackPoints(user: Record<string, unknown> | null | undefined): number {
  return Math.max(0, Math.round(Number(user?.pending_cashback_points) || 0));
}

/** ISO timestamp `months` from `fromMs` — the end of the seller+user commitment term. */
export function commitmentUntil(fromMs: number, months?: number): string {
  const m = Math.max(1, Math.round(months ?? sellerUserCommitmentMonths()));
  const d = new Date(fromMs);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString();
}

// ── Seller identity (one-click "become a seller"; everyone can) ─────────────────────────────────────────

/** Has the user opted in as a seller (one-click)? */
export function isSeller(user: Record<string, unknown> | null | undefined): boolean {
  return !!user && user.is_seller === true;
}

/** A stable public seller handle: the user's username, else a slug of their name/email, else their id. The
 *  account username acts as the seller username — no separate seller account. */
export function deriveSellerUsername(user: Record<string, unknown> | null | undefined): string {
  const raw = String(
    (user?.username as string) || (user?.seller_username as string) ||
    (user?.full_name as string) || (user?.email ? String(user.email).split("@")[0] : "") ||
    (user?.id as string) || "seller",
  );
  const slug = raw.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 32);
  return slug || String(user?.id || "seller");
}

/** Move any LOCKED pending_cashback_points into spendable points. Returns the amount swept. Re-reads each
 *  attempt (CAS on points) and decrements pending by exactly what moved, so a concurrent sale isn't lost. */
export async function sweepPendingCashback(userId: string): Promise<number> {
  const u = await db.get("User", userId).catch(() => null) as Record<string, unknown> | null;
  const held = Math.max(0, Math.round(Number(u?.pending_cashback_points) || 0));
  if (held <= 0) return 0;
  let swept = 0;
  for (let i = 0; i < 5 && !swept; i++) {
    const s = (await db.get("User", userId).catch(() => null) as Record<string, unknown> | null) || u!;
    const bal = Number(s.points) || 0;
    const ok = await db.updateIf("User", userId, { points: bal + held }, { field: "points", equals: String(bal) }).catch(() => false);
    if (ok) swept = held;
  }
  if (swept > 0) await db.incrementField("User", userId, "pending_cashback_points", -swept).catch(() => null);
  return swept;
}

// ── Active-seller LEVEL (recognition only — grants NO points, so it can't be farmed) ────────────────────
// A user reaches "Active Seller" by curating a real catalog (≥300 products across ≥30 distinct days ≈ the
// "10/day for a month" goal). This is a badge/level, not a payout — the 10% only ever pays on a real sale.
export const ACTIVE_SELLER_MIN_PRODUCTS = 300;
export const ACTIVE_SELLER_MIN_DAYS = 30;

/** Record that a user curated (added) one catalog product to their storefront; update the level counters. */
export async function recordCuratedAdd(userId: string, todayIso?: string): Promise<{ curated_count: number; active_days: number; is_active_seller: boolean }> {
  const u = (await db.get("User", userId).catch(() => null) as Record<string, unknown> | null) || {};
  const count = Math.max(0, Math.round(Number(u.curated_count) || 0)) + 1;
  const day = String(todayIso || new Date().toISOString()).slice(0, 10);
  const days = Array.isArray(u.curated_add_dates) ? (u.curated_add_dates as string[]).slice(-59) : [];
  if (day && !days.includes(day)) days.push(day);
  const is_active_seller = count >= ACTIVE_SELLER_MIN_PRODUCTS && days.length >= ACTIVE_SELLER_MIN_DAYS;
  await db.update("User", userId, { curated_count: count, curated_add_dates: days, active_seller: is_active_seller }).catch(() => null);
  return { curated_count: count, active_days: days.length, is_active_seller };
}

/** Read a user's seller-level snapshot for the UI (no writes). */
export function sellerLevel(user: Record<string, unknown> | null | undefined): { curated_count: number; active_days: number; is_active_seller: boolean; needed_products: number; needed_days: number } {
  const count = Math.max(0, Math.round(Number(user?.curated_count) || 0));
  const days = Array.isArray(user?.curated_add_dates) ? (user!.curated_add_dates as string[]).length : 0;
  return { curated_count: count, active_days: days, is_active_seller: !!user?.active_seller, needed_products: ACTIVE_SELLER_MIN_PRODUCTS, needed_days: ACTIVE_SELLER_MIN_DAYS };
}
