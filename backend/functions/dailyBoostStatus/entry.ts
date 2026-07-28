import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";

// dailyBoostStatus (authenticated) — "earn $4 in offers today → 5 minutes of free app use, no in-app
// purchase charges." Returns today's earnings vs the threshold, whether the boost is unlocked/claimed,
// the free-minutes, and any active free-app-time window. Net-neutral: funded by the offer revenue.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const threshold = await getNumber("DAILY_BOOST_THRESHOLD_USD", 4);
    const credit = await getNumber("DAILY_BOOST_CREDIT_USD", 1);
    const minutes = await getNumber("DAILY_BOOST_MINUTES", 5);

    // Best-effort read of today's earnings from DailyEarnings (adjust the field to your schema if needed).
    const rows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today }).catch(() => []) as any[];
    const earnedToday = (rows || []).reduce((s, r) => s + (Number(r.amount ?? r.earnings ?? r.total ?? r.usd) || 0), 0);

    const claimedToday = (user.last_daily_boost_date === today);
    const until = user.free_app_time_until || null;
    const windowActive = !!until && new Date(until).getTime() > Date.now();
    return Response.json({
      success: true,
      threshold_usd: threshold,
      earned_today_usd: Math.round(earnedToday * 100) / 100,
      unlocked: earnedToday >= threshold,
      claimed_today: claimedToday,
      minutes,
      credit_usd: credit,
      free_app_time_until: until,
      free_window_active: windowActive,
      app_time_credit_usd: Number(user.app_time_credit_usd) || 0,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
