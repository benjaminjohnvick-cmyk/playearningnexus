// bnpl-checkout.ts — PayPal Buy-Now-Pay-Later (Pay in 4 / Pay Monthly) as a checkout option for REAL GOODS.
//
// This lets a (premium) member finance an ACTUAL purchase of goods/services through PayPal Pay Later. PayPal
// pays the platform in full up front and PayPal (with its bank partner) carries the consumer credit risk — the
// platform is just the store. The member repays PayPal directly, from THEIR OWN funds; the platform never
// funds, covers, guarantees, or repays any part of the loan (see the brief — the "$2,000 boost", "repay with
// earnings", "refund-except-BNPL", and "add friends/family to pay it" ideas were all EXCLUDED for that reason).
//
// The optional service fee is modeled as a UNIFORM order-level fee — it is the same regardless of how the order
// is paid, so it is NOT a PayPal surcharge (PayPal's user agreement forbids surcharging for using PayPal). The
// only BNPL-specific logic here is the CAP: purchase + fee must fit under PayPal's Pay-in-4 limit, so the max
// financeable item price leaves room for the fee. Everything gated OFF by default pending counsel.
//
// NOTE: this module is the pure quote/eligibility/guard logic. The live PayPal Pay Later API call requires
// PayPal merchant onboarding + approval and is intentionally NOT invoked here.

import { snapBool, snapNumber } from "./settings.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const floor2 = (n: number) => Math.floor((Number(n) || 0) * 100) / 100;

// ── Config (OFF / conservative by default — PENDING COUNSEL) ────────────────────────────────────────────
export const bnplCheckoutEnabled = () => snapBool("BNPL_CHECKOUT_ENABLED", false);
/** Uniform order service fee fraction (default 0.10 = 10%). Applied the same for ANY payment method. */
export const bnplServiceFeePct = () => Math.min(1, Math.max(0, snapNumber("BNPL_SERVICE_FEE_PCT", 0.1)));
/** PayPal Pay-in-4 per-transaction ceiling (default $2,000). Pay Monthly is higher; set per product. */
export const bnplLimitUsd = () => Math.max(0, snapNumber("BNPL_LIMIT_USD", 2000));
/** Offer BNPL to premium members only (default true). */
export const bnplPremiumOnly = () => snapBool("BNPL_PREMIUM_ONLY", true);

// ── Pure core (unit-tested) ─────────────────────────────────────────────────────────────────────────────
export interface BnplOrder {
  itemPrice: number;      // price of the goods/services
  fee: number;            // uniform service fee (itemPrice * feePct)
  total: number;          // itemPrice + fee (the amount financed)
  withinLimit: boolean;   // does total fit under the PayPal limit?
  maxItemPrice: number;   // the largest item price whose total still fits under the limit
  limit: number;
}

/** Quote an order for BNPL: fee, financed total, whether it fits under the limit, and the max item price that
 *  would (leaving room for the fee). total = itemPrice * (1 + feePct); maxItemPrice = limit / (1 + feePct).
 *  Pure + deterministic. */
export function computeBnplOrder(itemPriceUsd: number, feePct: number, limitUsd: number): BnplOrder {
  const price = Math.max(0, round2(Number(itemPriceUsd) || 0));
  const pct = Math.min(1, Math.max(0, Number(feePct) || 0));
  const limit = Math.max(0, round2(Number(limitUsd) || 0));
  const fee = round2(price * pct);
  const total = round2(price + fee);
  const maxItemPrice = pct >= 0 ? floor2(limit / (1 + pct)) : limit;
  return { itemPrice: price, fee, total, withinLimit: total <= limit + 1e-9, maxItemPrice, limit };
}

/** The largest item price whose financed total (price + fee) still fits under the limit. Pure. */
export function maxFinanceableItemPrice(limitUsd: number, feePct: number): number {
  const pct = Math.min(1, Math.max(0, Number(feePct) || 0));
  return floor2((Math.max(0, Number(limitUsd) || 0)) / (1 + pct));
}

export interface BnplEligibility { eligible: boolean; reason: string; }
/** Is this member eligible to see the BNPL option? Enabled + (premium if premium-only). Pure. */
export function bnplEligible(opts: { enabled: boolean; isPremium: boolean; premiumOnly: boolean }): BnplEligibility {
  if (!opts.enabled) return { eligible: false, reason: "BNPL checkout disabled (pending counsel)" };
  if (opts.premiumOnly && !opts.isPremium) return { eligible: false, reason: "premium members only" };
  return { eligible: true, reason: "eligible" };
}
