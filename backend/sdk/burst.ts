// burst.ts — "earn on the go": complete surveys in short bursts through the day, resumable across devices.
//
// The daily goal (default $8 gross) is worked in bite-size bursts. Each burst is ONE straight-through unit
// (a whole BitLabs survey, or an AdGrid thumbnail) followed by a break — never a pause mid-survey. When
// BitLabs has nothing short/available, the burst router tops up from AdGrid (the non-reserved slice) so the
// day's goal stays reachable; when that's out too, it points at other enabled providers.
//
// This is a THROUGHPUT mechanic — it helps a user capture more of what's available; it doesn't change what a
// provider pays. So it stacks on top of the inventory levers (AdGrid access, CPX, reallocation), not instead.

import { snapNumber, snapBool } from "./settings.ts";

export const burstEnabled = () => snapBool("BURST_ENABLED", true);
export const burstDailyGoalUsd = () => Math.max(0, snapNumber("BURST_DAILY_GOAL_USD", 8));
export const burstDefaultSize = () => Math.max(1, Math.round(snapNumber("BURST_DEFAULT_SIZE", 3)));      // units per burst
export const burstTimedSeconds = () => Math.max(0, Math.round(snapNumber("BURST_TIMED_SECONDS", 60)));   // sprint length
export const burstBreakSeconds = () => Math.max(0, Math.round(snapNumber("BURST_BREAK_SECONDS", 20)));    // suggested break
/** Non-premium takes surveys in burst format by default (a UX default, not a lockout). */
export const burstMandatoryNonPremium = () => snapBool("BURST_MANDATORY_NONPREMIUM", true);

export type Pace = "survey" | "timed" | "count";
export function normalizePace(p: unknown): Pace {
  const s = String(p || "");
  return (s === "timed" || s === "count") ? s : "survey";
}

/** Daily progress for the burst UI. */
export interface BurstStatus {
  day: string;
  goal_usd: number;
  earned_usd: number;
  remaining_usd: number;
  pct: number;
  reached: boolean;
  bursts_completed: number;
}

export function computeBurstStatus(day: string, earnedUsd: number, burstsCompleted: number): BurstStatus {
  const goal = burstDailyGoalUsd();
  const earned = Math.max(0, Math.round((Number(earnedUsd) || 0) * 100) / 100);
  const remaining = Math.max(0, Math.round((goal - earned) * 100) / 100);
  return {
    day, goal_usd: goal, earned_usd: earned, remaining_usd: remaining,
    pct: goal > 0 ? Math.min(100, Math.round((earned / goal) * 100)) : 0,
    reached: earned >= goal && goal > 0,
    bursts_completed: Math.max(0, Math.round(Number(burstsCompleted) || 0)),
  };
}

export interface AvailableSurvey { id: string; loi_minutes?: number; reward?: number }

/** Pick the shortest available BitLabs survey (least length-of-interview) so each burst is a quick hit. */
export function shortestFirst(surveys: AvailableSurvey[]): AvailableSurvey | null {
  const list = (surveys || []).filter((s) => s && s.id);
  if (!list.length) return null;
  return [...list].sort((a, b) => (Number(a.loi_minutes ?? 99) - Number(b.loi_minutes ?? 99)))[0];
}

export type BurstMode = "bitlabs_survey" | "adgrid" | "other_provider" | "goal_reached" | "none";

/**
 * Decide the next burst unit. Order: goal reached → shortest BitLabs survey → AdGrid top-up (if access) →
 * other enabled provider → none. `adGridAllowed` comes from adgrid-access; `otherProviders` are enabled
 * offerwall keys beyond BitLabs.
 */
export function nextBurstDecision(opts: {
  status: BurstStatus; available: AvailableSurvey[]; adGridAllowed: boolean; otherProviders: string[];
}): { mode: BurstMode; survey?: AvailableSurvey; provider?: string; reason: string } {
  if (opts.status.reached) return { mode: "goal_reached", reason: "daily_goal_reached" };
  const short = shortestFirst(opts.available);
  if (short) return { mode: "bitlabs_survey", survey: short, reason: "shortest_bitlabs" };
  if (opts.adGridAllowed) return { mode: "adgrid", reason: "bitlabs_dry_adgrid_topup" };
  const other = (opts.otherProviders || []).find((p) => p && p !== "bitlabs");
  if (other) return { mode: "other_provider", provider: other, reason: "try_other_provider" };
  return { mode: "none", reason: "no_inventory_now" };
}
