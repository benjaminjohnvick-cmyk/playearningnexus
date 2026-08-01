import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { computeBurstStatus, burstDefaultSize, burstTimedSeconds, burstBreakSeconds, burstMandatoryNonPremium, normalizePace } from "../../sdk/burst.ts";

// burstDayStatus (authenticated) — the on-the-go daily progress: $ earned today vs the goal, bursts done,
// chosen pace, and the burst config. Powers the progress bar and the "next burst ready" prompt. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const earnRows = await db.filter("DailyEarnings", { user_id: user.id, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const earnedUsd = Number(earnRows?.[0]?.survey_gross) || Number(earnRows?.[0]?.total_earned) || 0;

    const bsRows = await db.filter("BurstSession", { user_id: user.id, day: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const bs = bsRows?.[0] || {};
    const status = computeBurstStatus(today, earnedUsd, Number(bs.bursts_completed) || 0);

    return Response.json({
      ...status,
      is_premium: await isPremiumUser(user.id),
      pace: normalizePace(bs.pace),
      config: {
        burst_size: burstDefaultSize(),
        timed_seconds: burstTimedSeconds(),
        break_seconds: burstBreakSeconds(),
        mandatory_nonpremium: burstMandatoryNonPremium(),
      },
      last_active_at: bs.last_active_at || null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
