import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { earnRateUsdPerMin, earnDailyCapUsd, ownershipPctFromCash } from "../../sdk/earn-rate.ts";

// savingsGoalStatus (authenticated) — live progress on the user's "bank toward this item" goals, measured
// against their current Site Cash balance. Fires a one-time "you're covered!" notification the first time a
// goal is fully covered (idempotent via notified_covered). Read-mostly.
//   Body: {}  → { site_cash_usd, goals: [...] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const pointUsd = pointValueUsd();
    const cashUsd = Math.round((Number(user.points) || 0) * pointUsd * 100) / 100;
    const premium = await isPremiumUser(user.id);
    const ratePerMin = earnRateUsdPerMin(premium);
    const cap = earnDailyCapUsd();

    const rows = await db.filter("ItemSavingsGoal", { created_by: user.id, status: "active" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];

    const goals = [];
    for (const g of rows) {
      const price = Number(g.price_usd) || 0;
      const pct = Math.round(ownershipPctFromCash(price, cashUsd) * 100) / 100;
      const covered = cashUsd >= price && price > 0;
      const remainUsd = Math.max(0, Math.round((price - cashUsd) * 100) / 100);
      const minutesLeft = ratePerMin > 0 ? Math.ceil(remainUsd / ratePerMin) : null;
      const daysLeft = cap > 0 ? Math.ceil(remainUsd / cap) : null;

      // One-time "covered" notification.
      if (covered && !g.notified_covered) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          title: "You've covered it! 🎉",
          message: `Your Site Cash now covers "${g.title || "your item"}". Redeem it any time — it ships fully covered.`,
          type: "reward",
        }).catch(() => null);
        await db.update("ItemSavingsGoal", g.id as string, { notified_covered: true }).catch(() => null);
      }

      goals.push({
        id: g.id,
        listing_id: g.listing_id || null,
        title: g.title || "Item",
        image_url: g.image_url || null,
        price_usd: Math.round(price * 100) / 100,
        ownership_pct: pct,
        covered,
        remaining_usd: remainUsd,
        minutes_left: minutesLeft,
        days_left: daysLeft,
      });
    }

    return Response.json({
      site_cash_usd: cashUsd,
      is_premium: premium,
      goals,
      note: "Site Cash spends only on this site and is never withdrawable.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
