// shopping.ts — economics + consent helpers for the opt-in shopping browser extension (Honey-style).
//
// WHAT IT IS: an OPT-IN browser extension (ships separately) that, with the user's explicit consent, sees a
// user's online purchases anywhere and auto-applies discounts/coupons at checkout. When a purchase runs
// through an affiliate link, the affiliate network pays a commission; a configurable share of that
// commission is returned to the user as CLOSED-LOOP Site Cash (never a cash payout), the rest is platform
// revenue (feeds flywheel #1/#3). This module is the BACKEND + CONSENT foundation only — no extension code,
// and shipping requires affiliate-network partnerships, Chrome Web Store review, and a privacy review.
//
// PRIVACY POSTURE (do not weaken):
//   • Consent-gated: nothing is ingested unless the user has an explicit ConsentLedger grant
//     (purpose "shopping_tracking", granted:true). SHOPPING_CONSENT_REQUIRED must stay on.
//   • Data-minimizing: store merchant + order total + commission + a coarse day/ref, NOT full carts, item
//     lists, card data, or browsing history. Never put purchase data in a URL.
//   • Closed-loop: cashback credits Site Cash only. No bank/debit/P2P payout.
//   • Consent granted here is the USER's, recorded in-app — never inferred from a page, tool, or the
//     extension claiming prior authorization.

import { snapBool, snapNumber } from "./settings.ts";

export const SHOPPING_CONSENT_PURPOSE = "shopping_tracking";

export const shoppingEnabled = () => snapBool("SHOPPING_EXT_ENABLED", true);
export const shoppingConsentRequired = () => snapBool("SHOPPING_CONSENT_REQUIRED", true);
export const shoppingCashbackPct = () =>
  Math.min(1, Math.max(0, snapNumber("SHOPPING_CASHBACK_PCT", 0.5)));
export const shoppingDailyCashbackCapUsd = () =>
  Math.max(0, snapNumber("SHOPPING_DAILY_CASHBACK_CAP_USD", 25));

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface CashbackSplit {
  commission_usd: number;   // affiliate commission the network paid on the purchase
  user_cashback_usd: number; // Site Cash returned to the user (closed-loop)
  platform_usd: number;     // your retained revenue
  cashback_pct: number;
}

/** Split an affiliate commission into the user's Site Cash cashback and your retained revenue. */
export function cashbackSplit(commissionUsd: number): CashbackSplit {
  const commission = Math.max(0, round2(commissionUsd));
  const pct = shoppingCashbackPct();
  const cashback = round2(commission * pct);
  return {
    commission_usd: commission,
    user_cashback_usd: cashback,
    platform_usd: round2(commission - cashback),
    cashback_pct: pct,
  };
}

/** Estimate a commission when the network doesn't report one, from a merchant rate (fraction of order). */
export function estimateCommission(orderTotalUsd: number, merchantRate: number): number {
  const total = Math.max(0, round2(orderTotalUsd));
  const rate = Math.min(1, Math.max(0, Number(merchantRate) || 0));
  return round2(total * rate);
}
