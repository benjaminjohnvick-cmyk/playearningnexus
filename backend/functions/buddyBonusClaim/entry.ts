import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd, recordSubsidy } from "../../sdk/revenue.ts";
import { buddyBonusUsd } from "../../sdk/buddy.ts";

// buddyBonusClaim (authenticated) — the "10% bump" for earning WITH a buddy: a closed-loop Site Cash bonus
// (a % of today's take, capped), granted once per day when the user has an active buddy and has earned
// today. Non-cashable, reserve-ledgered via recordSubsidy, and idempotent (one claim per day).
//   Body: {}  → { granted_usd, points, already? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);

    // Must have an active buddy today.
    const a = await db.filter("BuddyPair", { user_a: user.id, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const b = a?.[0] ? [] : await db.filter("BuddyPair", { user_b: user.id, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (!a?.[0] && !b?.[0]) return Response.json({ error: "No active buddy." }, { status: 400 });

    // Idempotent: one buddy bonus per day.
    const prior = await db.filter("Transaction", { user_id: user.id, type: "buddy_bonus", day: today }, "-created_date", 1).catch(() => []) as unknown[];
    if (prior && prior.length) return Response.json({ granted_usd: 0, points: 0, already: true });

    const earn = await db.filter("DailyEarnings", { user_id: user.id, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const takeUsd = Number(earn?.[0]?.total_earned) || 0;
    const bonusUsd = buddyBonusUsd(takeUsd);
    if (bonusUsd <= 0) return Response.json({ granted_usd: 0, points: 0, reason: "no_earnings_yet" });

    const pu = pointValueUsd() || 0.01;
    const points = Math.max(0, Math.round(bonusUsd / pu));
    if (points > 0) {
      await adjustUserBalance(user.id, points, { field: "points" });
      await adjustUserBalance(user.id, bonusUsd, { field: "total_earnings" }).catch(() => null);
      await recordSubsidy({ type: "buddy_bonus", amount_usd: bonusUsd, user_id: user.id, funded_by: "platform" }).catch(() => null);
      await base44.asServiceRole.entities.Transaction.create({
        user_id: user.id, type: "buddy_bonus", amount: bonusUsd, points, day: today, description: "Buddy bonus (earned with a buddy)",
      }).catch(() => null);
    }
    return Response.json({ granted_usd: bonusUsd, points });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
