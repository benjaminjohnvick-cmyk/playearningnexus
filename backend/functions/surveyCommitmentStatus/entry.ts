import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";
import { dayKey, grossForDay, computeStreak, commitTimeReached } from "../../sdk/commitment.ts";

// surveyCommitmentStatus (authenticated) — drives the daily nudge UI: today's progress toward the $8 goal,
// whether the (dismissible) prompt should show, the user's chosen time, and the current streak.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const goalUsd = await getNumber("SURVEY_DAILY_GOAL_USD", 8);
    const milestone = Math.max(1, Math.round(await getNumber("SURVEY_STREAK_MILESTONE_DAYS", 7)));
    const now = Date.now();
    const u = user as Record<string, unknown>;

    const rows = await base44.asServiceRole.entities.DailyEarnings
      .filter({ user_id: user.id }, "-date", 800).catch(() => []) as Record<string, unknown>[];
    const today = dayKey(now);
    const doneUsd = grossForDay(rows, today);
    const met = doneUsd >= goalUsd;
    const streak = computeStreak(rows, goalUsd, now);
    const timeReached = commitTimeReached(u.survey_commit_hour as number, Number(u.survey_commit_tz) || 0, now);

    return Response.json({
      goal_usd: goalUsd,
      done_usd: doneUsd,
      remaining_usd: Math.max(0, Math.round((goalUsd - doneUsd) * 100) / 100),
      met,
      // Show the (dismissible) prompt when they haven't finished today's goal and their chosen time has come.
      should_prompt: !met && timeReached,
      commit_hour: u.survey_commit_hour ?? null,
      has_commitment: u.survey_commit_hour != null,
      streak,
      streak_milestone: milestone,
      days_to_next_milestone: (milestone - (streak % milestone)) % milestone || milestone,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
