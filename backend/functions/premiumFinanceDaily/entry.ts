import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd } from "../../sdk/revenue.ts";
import { dayKey } from "../../sdk/earn-back.ts";
import { daysBetween, cycleOutcome } from "../../sdk/premium-finance.ts";

// premiumFinanceDaily (INTERNAL/ADMIN, scheduled daily) — for each active financed-Premium plan:
//   1) if the member earned today and hasn't been processed today, deduct $1 of Site Cash toward the
//      membership (never below 0) and add the day's earnings to the cycle's monthly total;
//   2) if the cycle has ended, close it: refund any overpayment as Site Cash, flag a successful month,
//      then RENEW (price covered) or DOWNGRADE to free (price not covered). No debt, no clawback.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    await primeSettings();
    const today = dayKey();
    const pointUsd = pointValueUsd();
    const plans = await db.filter("PremiumFinancePlan", { status: "active" }, "-created_date", 100000).catch(() => []) as Record<string, unknown>[];

    let deducted = 0, closed = 0, downgraded = 0, refunded = 0;

    for (const plan of plans) {
      const userId = String(plan.user_id || "");
      if (!userId) continue;
      const price = Number(plan.price_usd) || 0;
      const dailyUsd = Number(plan.daily_usd) || 1;

      let deductedUsd = Number(plan.deducted_usd) || 0;
      let earningDays = Number(plan.earning_days) || 0;
      let monthEarnings = Number(plan.month_earnings_usd) || 0;

      // 1) Daily deduction — once per day, only on days the member actually earned.
      if (String(plan.last_deduct_day || "") !== today) {
        const de = (await db.filter("DailyEarnings", { user_id: userId, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
        const grossToday = Number(de?.survey_gross) || Number(de?.total_earned) || 0;
        if (grossToday > 0) {
          const points = Math.round(dailyUsd / pointUsd);
          const ok = points > 0 ? await adjustUserBalance(userId, -points, { field: "points" }) : 0;   // null if insufficient
          if (ok !== null) { deductedUsd = Math.round((deductedUsd + dailyUsd) * 100) / 100; earningDays += 1; deducted++; }
          monthEarnings = Math.round((monthEarnings + grossToday) * 100) / 100;   // earnings count regardless of debit
          await db.update("PremiumFinancePlan", plan.id as string, {
            deducted_usd: deductedUsd, earning_days: earningDays, month_earnings_usd: monthEarnings,
            covered: deductedUsd >= price - 0.005, last_deduct_day: today,
          });
        }
      }

      // 2) Cycle close.
      const cycleDays = Number(plan.cycle_days) || 30;
      if (daysBetween(String(plan.cycle_start || today), today) >= cycleDays) {
        const outcome = cycleOutcome({ deductedUsd, priceUsd: price, monthEarningsUsd: monthEarnings });
        closed++;

        if (outcome.excess_usd > 0) {
          const pts = Math.round(outcome.excess_usd / pointUsd);
          if (pts > 0) { await adjustUserBalance(userId, pts, { field: "points" }); refunded++; }
        }

        if (outcome.downgrade) {
          // Price not covered → drop to free. Partial deductions stand as payment for the access used.
          const m = (await db.filter("PremiumPPCMembership", { user_id: userId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
          if (m?.id) await db.update("PremiumPPCMembership", String(m.id), { loyalty_enrolled: false, status: "downgraded_unfunded" }).catch(() => null);
          await db.update("PremiumFinancePlan", plan.id as string, {
            status: "downgraded", covered: false, qualified: outcome.qualified,
            closed_at: new Date().toISOString(), excess_refunded_usd: outcome.excess_usd,
          });
          downgraded++;
        } else {
          // Covered → renew for a fresh cycle; keep Premium.
          await db.update("PremiumFinancePlan", plan.id as string, {
            status: "active", cycle_start: today, deducted_usd: 0, earning_days: 0, month_earnings_usd: 0,
            covered: false, qualified: false, last_deduct_day: "",
            last_cycle_qualified: outcome.qualified, last_cycle_excess_usd: outcome.excess_usd,
          });
        }
      }
    }

    return Response.json({ ok: true, plans: plans.length, deducted, cycles_closed: closed, downgraded, refunded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
