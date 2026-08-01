import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { burstDailyGoalUsd } from "../../sdk/burst.ts";
import { isUnlocked, chatDailyLimit, buddyUnlockEarningsUsd } from "../../sdk/buddy.ts";

// buddyStatus (authenticated) — current buddy state: who you're paired with, both of today's progress, your
// unlock progress toward extended chat + connect, chat allowance left, and connect state. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const a = await db.filter("BuddyPair", { user_a: user.id, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const b = a?.[0] ? [] : await db.filter("BuddyPair", { user_b: user.id, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const pair = a?.[0] || b?.[0] || null;

    const cumulativeUsd = Number(user.total_earnings) || 0;
    const unlocked = isUnlocked(cumulativeUsd);

    // Today's messages sent (for the rate-limit display).
    let sentToday = 0;
    if (pair) {
      const msgs = await db.filter("BuddyMessage", { pair_id: pair.id, from_user_id: user.id, day: today }, "-created_date", 1000).catch(() => []) as unknown[];
      sentToday = (msgs || []).length;
    }

    const myEarn = await db.filter("DailyEarnings", { user_id: user.id, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const goal = burstDailyGoalUsd();

    let buddy = null;
    if (pair) {
      const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a;
      if (buddyId) {
        const be = await db.filter("DailyEarnings", { user_id: String(buddyId), date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
        const bu = await base44.asServiceRole.entities.User.filter({ id: String(buddyId) }).then((r: any) => r[0]).catch(() => null);
        buddy = {
          user_id: buddyId,
          display_name: bu?.full_name ? String(bu.full_name).split(" ")[0] : "Your buddy",   // first name only
          earned_today: Number(be?.[0]?.survey_gross) || Number(be?.[0]?.total_earned) || 0,
          goal_usd: goal,
        };
      }
    }

    return Response.json({
      has_buddy: !!(pair && (pair.user_a && pair.user_b)),
      pair_id: pair?.id || null,
      status: pair ? pair.status : "none",
      me: { earned_today: Number(myEarn?.[0]?.survey_gross) || Number(myEarn?.[0]?.total_earned) || 0, goal_usd: goal },
      buddy,
      unlock: {
        unlocked,
        threshold_usd: buddyUnlockEarningsUsd(),
        cumulative_usd: Math.round(cumulativeUsd * 100) / 100,
        remaining_usd: Math.max(0, Math.round((buddyUnlockEarningsUsd() - cumulativeUsd) * 100) / 100),
      },
      chat: { sent_today: sentToday, daily_limit: chatDailyLimit(unlocked), remaining: Math.max(0, chatDailyLimit(unlocked) - sentToday) },
      connect: { requested_by: pair?.connect_request_by || null, connected: !!pair?.connected },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
