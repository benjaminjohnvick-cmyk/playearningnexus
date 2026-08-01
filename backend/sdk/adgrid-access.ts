// adgrid-access.ts — who may pull the high-paying AdGrid inventory, and with what priority.
//
// Premium members always get AdGrid (their tier perk). Non-premium members can ALSO tap AdGrid — but only
// from the capacity left after a premium reserve, capped per user per day, and only while inventory lasts;
// otherwise they fall back to BitLabs. A non-premium user holding a one-day reallocation grant (see
// reallocation.ts) is treated at premium priority for that day.
//
// This shares inventory you already sell to advertisers — no cash subsidy — so parity scales honestly with
// how many advertisers you sign. The reserve keeps premium from ever being crowded out.

import { snapNumber, snapBool } from "./settings.ts";

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

export const adgridNonPremiumEnabled = () => snapBool("ADGRID_NONPREMIUM_ENABLED", true);
export const adgridPremiumReservePct = () => clamp01(snapNumber("ADGRID_PREMIUM_RESERVE_PCT", 0.5));
export const adgridNonPremiumDailyCap = () => Math.max(0, Math.round(snapNumber("ADGRID_NONPREMIUM_DAILY_SESSION_CAP", 1)));

export type AccessPriority = "premium" | "granted" | "nonpremium" | "none";

export interface AccessInput {
  isPremium: boolean;
  hasGrant: boolean;                 // holds a reallocated one-day AdGrid pass today
  activeAdCount: number;             // active AdGrid inventory available right now
  nonPremiumSessionsUsedToday: number;
}

export interface AccessResult {
  allowed: boolean;
  priority: AccessPriority;
  provider: "ppc_adgrid" | "bitlabs";
  reason: string;
}

/**
 * Decide AdGrid access for one user. Premium and granted users always get AdGrid; non-premium get it from
 * the non-reserved slice of inventory, under their daily cap, else fall back to BitLabs.
 */
export function adGridAccess(input: AccessInput): AccessResult {
  if (input.isPremium) {
    return { allowed: true, priority: "premium", provider: "ppc_adgrid", reason: "premium_tier" };
  }
  if (input.hasGrant) {
    return { allowed: true, priority: "granted", provider: "ppc_adgrid", reason: "reallocated_slot" };
  }
  if (!adgridNonPremiumEnabled()) {
    return { allowed: false, priority: "none", provider: "bitlabs", reason: "nonpremium_adgrid_off" };
  }
  // Inventory beyond the premium reserve is available to non-premium.
  const available = Math.floor(Math.max(0, input.activeAdCount) * (1 - adgridPremiumReservePct()));
  if (available < 1) {
    return { allowed: false, priority: "none", provider: "bitlabs", reason: "reserved_for_premium" };
  }
  const cap = adgridNonPremiumDailyCap();
  if (cap > 0 && input.nonPremiumSessionsUsedToday >= cap) {
    return { allowed: false, priority: "none", provider: "bitlabs", reason: "nonpremium_daily_cap" };
  }
  return { allowed: true, priority: "nonpremium", provider: "ppc_adgrid", reason: "nonpremium_from_reserve" };
}
