import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { dayKey, grossForDay, computeStreak, commitTimeReached } from "../../sdk/commitment.ts";
import { recordSubsidy, pointValueUsd } from "../../sdk/revenue.ts";

// surveyCommitmentReminder (INTERNAL/ADMIN, scheduled) — the daily nudge engine. For each user with a
// commitment: if their time has come and they haven't hit the $8 goal, drop a reminder notification. And
// award a streak bonus (once per day) when a user reaches a streak milestone. Bounded scan; App-Store-safe
// (notification only — never blocks the user).
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const goalUsd = await getNumber("SURVEY_DAILY_GOAL_USD", 8);
    const milestone = Math.max(1, Math.round(await getNumber("SURVEY_STREAK_MILESTONE_DAYS", 7)));
    const bonusPoints = Math.max(0, Math.round(await getNumber("SURVEY_STREAK_BONUS_POINTS", 100)));
    const now = Date.now();
    const today = dayKey(now);

    const users = await base44.asServiceRole.entities.User.filter({}, undefined, 50000).catch(() => []) as Record<string, unknown>[];
    let reminded = 0, bonuses = 0;

    for (const u of (users || [])) {
      if (u.survey_commit_hour == null) continue;                    // only users who opted into a time
      const rows = await base44.asServiceRole.entities.DailyEarnings
        .filter({ user_id: u.id }, "-date", 400).catch(() => []) as Record<string, unknown>[];
      const doneUsd = grossForDay(rows, today);
      const met = doneUsd >= goalUsd;

      // Streak-milestone bonus (idempotent per day via survey_streak_last_bonus_day).
      if (met) {
        const streak = computeStreak(rows, goalUsd, now);
        if (bonusPoints > 0 && streak > 0 && streak % milestone === 0 && u.survey_streak_last_bonus_day !== today) {
          await adjustUserBalance(String(u.id), bonusPoints, { field: "points" }).catch(() => null);
          await base44.asServiceRole.entities.User.update(String(u.id), { survey_streak_last_bonus_day: today, survey_streak: streak }).catch(() => null);
          await recordSubsidy({ type: "other", amount_usd: bonusPoints * pointValueUsd(), user_id: String(u.id), funded_by: "advertiser_pool+breakage", meta: { streak, milestone, note: "streak_bonus" } }).catch(() => null);
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id, type: "streak_bonus", title: `🔥 ${streak}-day streak!`,
            message: `You hit a ${streak}-day survey streak — here's a ${bonusPoints}-point bonus. Keep it going!`, is_read: false,
          }).catch(() => null);
          bonuses++;
        }
        continue;                                                    // done today → no reminder
      }

      // Not done + their time has come → remind (once/day via survey_last_reminder_day).
      if (commitTimeReached(u.survey_commit_hour as number, Number(u.survey_commit_tz) || 0, now) && u.survey_last_reminder_day !== today) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id, type: "survey_reminder", title: "⏰ Time for your surveys",
          message: `You're $${Math.max(0, goalUsd - doneUsd).toFixed(2)} from today's $${goalUsd} goal. Finish now to keep your streak alive.`, is_read: false,
        }).catch(() => null);
        await base44.asServiceRole.entities.User.update(String(u.id), { survey_last_reminder_day: today }).catch(() => null);
        reminded++;
      }
    }

    return Response.json({ success: true, reminded, streak_bonuses: bonuses });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
