// funding-pool.ts — where the seller cash-back (and other subsidies) are funded from, honestly.
//
// Order of draw: (1) BREAKAGE — closed-loop points that will never be redeemed are retained value, so a
// perk paid in points is largely "free" up to the breakage headroom; (2) the ADVERTISER POOL — the AdGrid
// revenue that already out-earns these perks many times over. Nothing here creates money; it accounts for
// which existing source covers a platform-funded perk, so the books stay honest.
//
// Pure math only (no queries) — callers pass in the figures they've computed so this stays cheap.

import { round2 } from "./premium-ppc.ts";

/** Recognized breakage value (USD) from outstanding closed-loop points. */
export function breakageUsd(outstandingPoints: number, recognitionPct: number, pointUsd: number): number {
  return round2(Math.max(0, Number(outstandingPoints) || 0) * Math.max(0, pointUsd) * Math.min(1, Math.max(0, recognitionPct)));
}

export interface Coverage {
  subsidy_usd: number;
  from_breakage_usd: number;
  from_pool_usd: number;
  shortfall_usd: number;
  covered: boolean;
}

/** How a subsidy (e.g. cash-back liabilities) is covered: breakage first, then the advertiser pool. */
export function coverage(subsidyUsd: number, breakageAvailUsd: number, poolAvailUsd: number): Coverage {
  const subsidy = round2(Math.max(0, Number(subsidyUsd) || 0));
  const fromBreakage = round2(Math.min(subsidy, Math.max(0, Number(breakageAvailUsd) || 0)));
  const remaining = round2(subsidy - fromBreakage);
  const fromPool = round2(Math.min(remaining, Math.max(0, Number(poolAvailUsd) || 0)));
  const shortfall = round2(Math.max(0, remaining - fromPool));
  return { subsidy_usd: subsidy, from_breakage_usd: fromBreakage, from_pool_usd: fromPool, shortfall_usd: shortfall, covered: shortfall <= 0 };
}
