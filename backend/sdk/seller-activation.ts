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
