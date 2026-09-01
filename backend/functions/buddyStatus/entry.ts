import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { burstDailyGoalUsd } from "../../sdk/burst.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { isUnlocked, chatDailyLimit, buddyUnlockEarningsUsd, buddyCommitEnabled, buddyCommitTargetUsd, buddyMandatoryNonPremium, buddyMatchWaitSeconds, buddyChatIdleSeconds } from "../../sdk/buddy.ts";
import { bookingEnabled, premiumAvailable, withinStartWindow } from "../../sdk/buddy-schedule.ts";

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
    const premium = await isPremiumUser(user.id);
    const mandatory = buddyMandatoryNonPremium() && !premium;   // non-premium can't opt out; premium can

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
          earned_take: Number(be?.[0]?.total_earned) || 0,
          goal_usd: goal,
        };
      }
    }

    // Next-session booking (all tiers): the user's booked slot for tomorrow, and whether it's time to auto-open.
    const booking_on = bookingEnabled();
    let next_session: Record<string, unknown> | null = null;
    if (booking_on) {
      const bk = await db.filter("BuddyNextSession", { user_id: user.id, status: "booked" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      const nt = bk?.[0] ? [] : await db.filter("BuddyNextSession", { user_id: user.id, status: "notified" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      const slot = bk?.[0] || nt?.[0] || null;
      if (slot) {
        const at = String(slot.next_session_at || "");
        const openNow = at ? withinStartWindow(at) : false;
        next_session = {
          booked: true,
          next_session_at: at,
          local_time: slot.local_time ?? null,
          timezone: slot.timezone ?? null,
          can_start_now: openNow,
          should_auto_open: openNow,   // the client polls this and pops Buddy Chat open at the chosen moment
        };
      } else {
        next_session = { booked: false };
      }
    }

    // Commitment (accountability, not a cage — Leave/Report always work). Applies to all tiers.
    const commitTarget = buddyCommitTargetUsd();
    const iAmA = pair ? pair.user_a === user.id : false;
    const myTake = Number(myEarn?.[0]?.total_earned) || 0;
    const commitment = {
      enabled: buddyCommitEnabled(),
      target_usd: commitTarget,
      i_committed: pair ? (iAmA ? !!pair.committed_a : !!pair.committed_b) : false,
      buddy_committed: pair ? (iAmA ? !!pair.committed_b : !!pair.committed_a) : false,
      my_take_usd: Math.round(myTake * 100) / 100,
      my_done: myTake >= commitTarget,
      buddy_take_usd: buddy?.earned_take || 0,
      buddy_done: (buddy?.earned_take || 0) >= commitTarget,
      both_done: myTake >= commitTarget && (buddy?.earned_take || 0) >= commitTarget,
    };

    return Response.json({
      has_buddy: !!(pair && (pair.user_a && pair.user_b)),
      pair_id: pair?.id || null,
      status: pair ? pair.status : "none",
      is_premium: premium,
      available_to_premium: premiumAvailable(),   // Buddy Chat is open to premium users too
      booking_enabled: booking_on,
      next_session,   // { booked, next_session_at, local_time, timezone, can_start_now, should_auto_open } | null
      mandatory,   // non-premium can't turn buddy chat off; safety valves (leave/report→re-match) still apply
      match_wait_seconds: buddyMatchWaitSeconds(),   // wait this long for a 1:1, then auto-add to a group
      chat_idle_seconds: buddyChatIdleSeconds(),     // chat/voice pauses after this long without a survey

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
      commitment,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
