import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";

// claimDailyBoost (authenticated) — grants 5 MINUTES of free app use (no in-app-purchase charges) ONCE
// per day, only if the user has earned the threshold ($4) in offers today. It opens a time-boxed window
// (free_app_time_until) plus a credit cap the game store honors at checkout while the window is open.
// Net-neutral: funded by the advertiser revenue from those offers.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    if (user.last_daily_boost_date === today) {
      return Response.json({ error: "Daily Boost already claimed today.", already_claimed: true }, { status: 409 });
    }

    const threshold = await getNumber("DAILY_BOOST_THRESHOLD_USD", 4);
    const rows = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: user.id, date: today }).catch(() => []) as any[];
    const earnedToday = (rows || []).reduce((s, r) => s + (Number(r.amount ?? r.earnings ?? r.total ?? r.usd) || 0), 0);
    if (earnedToday < threshold) {
      return Response.json({ error: `Earn $${threshold} in offers today to unlock the boost.`, earned_today_usd: Math.round(earnedToday * 100) / 100, threshold_usd: threshold }, { status: 400 });
    }

    const credit = await getNumber("DAILY_BOOST_CREDIT_USD", 1);
    const minutes = await getNumber("DAILY_BOOST_MINUTES", 5);
    const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
    // Re-check the claim flag on the fresh row to avoid a double-grant race.
    if (fresh.last_daily_boost_date === today) {
      return Response.json({ error: "Daily Boost already claimed today.", already_claimed: true }, { status: 409 });
    }
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    // Reset the per-window credit cap to today's cap and open the free window.
    await base44.asServiceRole.entities.User.update(user.id, {
      app_time_credit_usd: credit, free_app_time_until: until, last_daily_boost_date: today,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "daily_boost",
      title: "⚡ Daily Boost unlocked!", message: `Your next ${minutes} minutes are on us — in-app purchases are free until then (up to $${credit}).`, is_read: false,
    }).catch(() => null);

    return Response.json({ success: true, minutes, credit_usd: credit, free_app_time_until: until });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
