// Group Goals — the COMPLIANT "work toward a big-ticket item with friends" engine.
//
// COMPLIANCE POSTURE (the whole point): there is NO shared wallet and NO transfer of value between
// users. Every member's points stay in THEIR OWN account, spendable only by them. A group shares a
// GOAL, not a pot: the platform simply READS and SUMS each member's own earning progress. When the
// group collectively crosses the milestone, the PLATFORM funds a reward (non-cashable, closed-loop,
// capped store credit) that each member claims for their OWN account. Value only ever flows
// platform → member, never member → member — structurally identical to a "refer friends, you all get
// a discount" loyalty promotion, NOT money transmission. Progress is measured as realized earnings
// accrued AFTER a member joins (baseline snapshot at join), so nothing is double-counted or moved.
//
// State lives on the GroupGoal record (JSONB — no schema change beyond the table).

import { snapNumber } from "./settings.ts";
import { round2 } from "./premium-ppc.ts";

// ── Config knobs ────────────────────────────────────────────────────────────────────────────────
/** Platform-funded group reward as a fraction of the target item's price (granted as non-cashable points). */
export const groupGoalDiscountPct = () => Math.min(1, Math.max(0, snapNumber("GROUP_GOAL_DISCOUNT_PCT", 0.10)));
/** Hard cap on the per-member reward value (USD). The reward is platform-absorbed; this bounds the liability. */
export const groupGoalRewardCapUsd = () => round2(Math.max(0, snapNumber("GROUP_GOAL_REWARD_CAP_USD", 100)));
/** Max members per group. */
export const groupGoalMaxMembers = () => Math.max(2, Math.round(snapNumber("GROUP_GOAL_MAX_MEMBERS", 10)));
/** Point value in cents (for USD → points conversion of the reward). */
export const pointValueCents = () => Math.max(1, snapNumber("POINT_VALUE_CENTS", 1));

/** The platform-funded reward VALUE (USD) for a group whose target item costs `targetUsd`, capped. */
export function rewardUsdFor(targetUsd: number): number {
  const raw = round2(Math.max(0, Number(targetUsd) || 0) * groupGoalDiscountPct());
  return round2(Math.min(raw, groupGoalRewardCapUsd()));
}

/** The reward expressed in POINTS (non-cashable, 1 point = POINT_VALUE_CENTS cents). */
export function rewardPointsFor(targetUsd: number): number {
  return Math.max(0, Math.round((rewardUsdFor(targetUsd) * 100) / pointValueCents()));
}

/** A member's own progress toward the group goal: realized earnings since they joined (never negative). */
export function memberProgressUsd(baselineUsd: number, currentTotalEarnings: number): number {
  return round2(Math.max(0, (Number(currentTotalEarnings) || 0) - (Number(baselineUsd) || 0)));
}

/**
 * Summed, read-only group progress. `usersById` maps member id → their CURRENT total_earnings. Nothing
 * here mutates anything or moves any value — it only reports.
 */
export function computeGroupProgress(
  group: Record<string, unknown>,
  usersById: Record<string, number>,
): { progress_usd: number; milestone_usd: number; reached: boolean; per_member: Array<{ user_id: string; progress_usd: number }> } {
  const baselines = (group.member_baselines || {}) as Record<string, number>;
  const members = (group.member_ids || []) as string[];
  const per_member = members.map((uid) => ({
    user_id: uid,
    progress_usd: memberProgressUsd(Number(baselines[uid]) || 0, Number(usersById[uid]) || 0),
  }));
  const progress_usd = round2(per_member.reduce((s, m) => s + m.progress_usd, 0));
  const milestone_usd = round2(Number(group.milestone_usd) || Number(group.target_usd) || 0);
  return { progress_usd, milestone_usd, reached: milestone_usd > 0 && progress_usd >= milestone_usd, per_member };
}

/** Standard disclosure shown wherever the group reward appears (keeps the promo framing honest). */
export const GROUP_GOAL_DISCLOSURE =
  "Everyone keeps their own points — nothing is pooled or transferred. When your group reaches its goal " +
  "together, the platform adds a bonus in non-cashable store-credit points to each member's own account. " +
  "Progress depends on your own activity; this is a promotional reward, not a guaranteed earning or a payout.";
