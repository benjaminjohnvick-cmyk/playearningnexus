import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { dayKey } from "../../sdk/earn-back.ts";
import {
  premiumFinanceEnabled, financeDailyUsd, financeCycleDays, financePriceUsd,
  financeSuccessMonthlyUsd, daysBetween,
} from "../../sdk/premium-finance.ts";

// premiumFinanceStatus (authenticated) — the member's financed-Premium progress: membership % paid, Site
// Cash overpayment building, monthly earning total vs the successful-month target, and days left in the
// cycle. Read-only.
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const premium = await isPremiumUser(user.id);
    const plan = (await db.filter("PremiumFinancePlan", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0] || null;

    const base = {
      enabled: premiumFinanceEnabled(),
      is_premium: premium,
      daily_usd: financeDailyUsd(),
      cycle_days: financeCycleDays(),
      price_usd: financePriceUsd({}),
      success_target_usd: financeSuccessMonthlyUsd(),
    };

    if (!plan || plan.status !== "active") {
      return Response.json({ ...base, has_plan: false, note: "Get Premium with no upfront charge — $1/day comes out of your earnings, and the leftover comes back as Site Cash at month's end." });
    }

    const price = Number(plan.price_usd) || base.price_usd;
    const deducted = Number(plan.deducted_usd) || 0;
    const monthEarnings = Number(plan.month_earnings_usd) || 0;
    const cycleDay = Math.min(Number(plan.cycle_days) || 30, daysBetween(String(plan.cycle_start || dayKey()), dayKey()) + 1);
    const daysLeft = Math.max(0, (Number(plan.cycle_days) || 30) - (cycleDay - 1));

    return Response.json({
      ...base,
      has_plan: true,
      price_usd: price,
      membership_paid_pct: price > 0 ? Math.min(100, Math.round((deducted / price) * 100)) : 0,
      covered: deducted >= price - 0.005,
      excess_building_usd: Math.round(Math.max(0, deducted - price) * 100) / 100,
      earning_days: Number(plan.earning_days) || 0,
      month_earnings_usd: monthEarnings,
      qualified: monthEarnings >= financeSuccessMonthlyUsd() - 0.005,
      cycle_day: cycleDay,
      days_left: daysLeft,
      note: "Site Cash spends only on this site — it's never withdrawable. If you don't cover the membership this cycle you'll move to the free plan, no charge and no debt.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
