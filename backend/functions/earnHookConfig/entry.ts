import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import {
  earnHookEnabled, earnReminderEnabled, earnRewardPerAdPoints, earnRewardDailyCapUsd,
  grantablePointsForOneAd, offerEligible, pointsToUsd, rewardTotals,
  earnContinuousEnabled, earnContinuousReconfirmEvery, earnContinuousMaxSessionMin,
} from "../../sdk/earn-hook.ts";

// earnHookConfig (authenticated) — powers the earn-hook widget feed + the in-app settings/earn screen. Returns
// the user's Site-Cash balance, streak, whether a rewarded ad can still be earned right now (caps), the user's
// hook/reminder preferences, and whether the end-of-session offer may be shown. Read-only. If the feature is off
// (or the user isn't opted into rewards) it returns enabled:false and shows nothing. No ads and no PII here.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!earnHookEnabled()) return Response.json({ enabled: false });

    const u = user as Record<string, unknown>;
    const balancePts = Math.max(0, Number(u.points) || 0);
    const streak = Number(u.current_streak) || Number(u.daily_streak) || Number(u.streak) || 0;

    const grantable = await grantablePointsForOneAd(String(user.id));
    const { todayUsd } = await rewardTotals(String(user.id));

    return Response.json({
      enabled: true,
      // Widget feed (our own content — no ads):
      balance_points: balancePts,
      balance_usd: pointsToUsd(balancePts),
      streak,
      ad_available: grantable > 0,                 // false once the daily/lifetime cap is hit
      reward_per_ad_points: earnRewardPerAdPoints(),
      earned_today_usd: todayUsd,
      daily_cap_usd: earnRewardDailyCapUsd(),
      // User preferences (opt-out for the hook option; opt-in for the reminder):
      prefs: {
        open_straight_to_earn: u.earn_hook_open_straight_to_earn === true,
        reminder_opt_in: u.earn_reminder_opt_in === true,
        reminder_time: (u.earn_reminder_time as string) || null,
        reminder_offered: earnReminderEnabled(),
        continuous_opt_in: u.earn_continuous_opt_in === true,
      },
      // Continuous earn session (opt-in): the client plays rewarded ads in sequence, requiring a "keep earning?"
      // tap every `reconfirm_every` ads (presence check) and ending at `max_session_min` or when `ad_available`
      // goes false (cap hit). Never hands-off auto-play.
      continuous: {
        offered: earnContinuousEnabled(),
        opt_in: u.earn_continuous_opt_in === true,
        reconfirm_every: earnContinuousReconfirmEvery(),
        max_session_min: earnContinuousMaxSessionMin(),
      },
      // Whether the end-of-session "earn extra today?" offer may show now (frequency-capped):
      offer_eligible: offerEligible((u.earn_hook_offer_last_shown as string) || null),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
