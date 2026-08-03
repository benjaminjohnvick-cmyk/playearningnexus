// marketplace-fee.ts — third-party seller economics (flywheel #3, the classic Amazon move).
//
// Open the store to third-party sellers and take a commission on their sales — plus fulfillment margin and
// seller advertising. The closed-loop Site Cash is the differentiator: users MUST spend on-platform, so the
// demand you route to sellers is guaranteed and capturable. See SCALE-TO-AMAZON-STRATEGY.md.

import { snapBool, snapNumber } from "./settings.ts";

export const thirdPartySellersEnabled = () => snapBool("MARKETPLACE_THIRD_PARTY_ENABLED", true);
export const marketplaceCommissionPct = () => Math.min(1, Math.max(0, snapNumber("MARKETPLACE_COMMISSION_PCT", 0.12)));

export interface SaleSplit {
  gross_usd: number;
  commission_usd: number;   // your platform commission
  seller_net_usd: number;   // what the seller receives
  commission_pct: number;
}

/** Split a third-party sale into your commission and the seller's net. */
export function sellerSaleSplit(grossUsd: number): SaleSplit {
  const gross = Math.max(0, Math.round((Number(grossUsd) || 0) * 100) / 100);
  const pct = marketplaceCommissionPct();
  const commission = Math.round(gross * pct * 100) / 100;
  return { gross_usd: gross, commission_usd: commission, seller_net_usd: Math.round((gross - commission) * 100) / 100, commission_pct: pct };
}

// ── Marketplace-equivalent hold (revised flywheel #3) ────────────────────────────────────────────────
// You hold NO inventory — users can look up whatever they want anywhere. Rather than collect commission
// from third-party sellers, hold back an equal percentage of GROSS survey revenue as the same revenue line.
// This is applied to gross BEFORE the user's survey share, so it slightly lowers the user pool and MUST be
// disclosed (Terms + earn-rate page). Toggle with MARKETPLACE_EQUIV_HOLD_ENABLED.

export const marketplaceEquivHoldEnabled = () => snapBool("MARKETPLACE_EQUIV_HOLD_ENABLED", true);
export const marketplaceEquivHoldPct = () =>
  Math.min(1, Math.max(0, snapNumber("MARKETPLACE_EQUIV_HOLD_PCT", 0.12)));

export interface EquivHold {
  gross_usd: number;      // original gross survey revenue
  hold_usd: number;       // amount held back as the marketplace-equivalent line
  net_gross_usd: number;  // gross remaining after the hold, on which the user share is computed
  hold_pct: number;
}

/** Apply the marketplace-equivalent hold to a gross survey amount. Returns the held amount (your revenue)
 *  and the net gross the user's share should be computed from. No-op (0 hold) when disabled. */
export function applyMarketplaceEquivHold(grossUsd: number): EquivHold {
  const gross = Math.max(0, Math.round((Number(grossUsd) || 0) * 100) / 100);
  const pct = marketplaceEquivHoldEnabled() ? marketplaceEquivHoldPct() : 0;
  const hold = Math.round(gross * pct * 100) / 100;
  return { gross_usd: gross, hold_usd: hold, net_gross_usd: Math.round((gross - hold) * 100) / 100, hold_pct: pct };
}
