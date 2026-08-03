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
