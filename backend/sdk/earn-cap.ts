// Per-user daily earnings cap (DAILY_EARN_CAP_USD; 0 = no cap).
//
// A shared chokepoint so earning writers don't each re-implement the cap. Given a proposed earning,
// it returns how much the user may actually take today based on their DailyEarnings total so far.
// Wire it at each earning credit: clamp the credited amount to `allowed`.

import { getNumber } from "./settings.ts";

export interface EarnAllowance { allowed: number; capped: boolean; cap: number; earnedToday: number }

export async function allowedEarn(base44: any, userId: string, proposed: number): Promise<EarnAllowance> {
  const cap = await getNumber("DAILY_EARN_CAP_USD", 0);
  const p = Math.max(0, Number(proposed) || 0);
  if (cap <= 0 || !userId) return { allowed: p, capped: false, cap, earnedToday: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const rows = await base44.asServiceRole.entities.DailyEarnings
    .filter({ user_id: userId, date: today }).catch(() => []);
  const earnedToday = (rows || []).reduce(
    (s: number, r: Record<string, unknown>) => s + (Number(r.total_earned ?? r.amount) || 0), 0);

  const remaining = Math.max(0, cap - earnedToday);
  const allowed = Math.round(Math.min(p, remaining) * 100) / 100;
  return { allowed, capped: allowed < p, cap, earnedToday: Math.round(earnedToday * 100) / 100 };
}
