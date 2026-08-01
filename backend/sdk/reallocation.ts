// reallocation.ts — reallocate an unused premium AdGrid slot to a high-value non-premium member.
//
// When a premium member doesn't use their AdGrid slot on a given day, that idle high-paying inventory is
// handed to the best non-premium member: one who CONSISTENTLY earns their full daily take-home and has a
// high engagement score. This fills unused inventory and rewards your most engaged free users. It moves
// INVENTORY, not cash — no subsidy, no reserve draw.

import { snapNumber } from "./settings.ts";

export const reallocLookbackDays = () => Math.max(1, Math.round(snapNumber("REALLOC_LOOKBACK_DAYS", 7)));
export const reallocMinConsistentDays = () => Math.max(1, Math.round(snapNumber("REALLOC_MIN_CONSISTENT_DAYS", 5)));
export const reallocMinDailyTakeUsd = () => Math.max(0, snapNumber("REALLOC_MIN_DAILY_TAKE_USD", 4));
export const reallocEngagementMin = () => Math.max(0, snapNumber("REALLOC_ENGAGEMENT_MIN", 3));
export const reallocMaxGrantsPerDay = () => Math.max(0, Math.round(snapNumber("REALLOC_MAX_GRANTS_PER_DAY", 500)));

export interface DailyTake { day: string; take_usd: number }

/**
 * Engagement score from a user's trailing daily history. Simple, tunable:
 *   consistent-days (take ≥ threshold) + active-days + a recency bump for earning today − heavy-DQ penalty.
 */
export function engagementScore(opts: {
  history: DailyTake[]; earnedToday: boolean; disqualifications?: number; minTakeUsd: number;
}): number {
  const hist = opts.history || [];
  const consistent = hist.filter((d) => (Number(d.take_usd) || 0) >= opts.minTakeUsd).length;
  const active = hist.filter((d) => (Number(d.take_usd) || 0) > 0).length;
  const recency = opts.earnedToday ? 2 : 0;
  const dqPenalty = Math.min(3, Math.max(0, Number(opts.disqualifications) || 0) * 0.25);
  return Math.round((consistent * 1.5 + active * 0.5 + recency - dqPenalty) * 100) / 100;
}

/** Is this non-premium user eligible for a reallocated slot? Consistent earner + engaged. */
export function reallocEligible(opts: { history: DailyTake[]; engagement: number }): { eligible: boolean; consistent_days: number } {
  const minTake = reallocMinDailyTakeUsd();
  const consistent = (opts.history || []).filter((d) => (Number(d.take_usd) || 0) >= minTake).length;
  const eligible = consistent >= reallocMinConsistentDays() && opts.engagement >= reallocEngagementMin();
  return { eligible, consistent_days: consistent };
}

/** Rank eligible candidates (engagement desc, then consistency desc) and take the top `slots`. */
export function rankCandidates<T extends { engagement: number; consistent_days: number }>(candidates: T[], slots: number): T[] {
  return [...candidates]
    .sort((a, b) => (b.engagement - a.engagement) || (b.consistent_days - a.consistent_days))
    .slice(0, Math.max(0, slots));
}
