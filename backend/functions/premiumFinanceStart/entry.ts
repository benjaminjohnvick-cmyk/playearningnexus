import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { dayKey } from "../../sdk/earn-back.ts";
import { premiumFinanceEnabled, financeDailyUsd, financeCycleDays, financePriceUsd } from "../../sdk/premium-finance.ts";

// premiumFinanceStart (authenticated) — enroll in Premium with NO upfront charge. Premium is granted
// immediately; $1/day is then deducted from earned Site Cash toward the price over the cycle. Pay-as-you-earn
// from rewards — nothing is fronted, so it isn't credit. If the price is never covered the member downgrades
// to free (handled at cycle close). Overpayment returns as Site Cash.
//   Body: {}  → { plan_id, price_usd, daily_usd, cycle_days }
export default __handler(async (req) => {
  try {
    await primeSettings();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!premiumFinanceEnabled()) return Response.json({ error: "Financed Premium is turned off." }, { status: 403 });

    if (await isPremiumUser(user.id)) return Response.json({ error: "You're already a Premium member.", already_premium: true }, { status: 409 });

    const active = await db.filter("PremiumFinancePlan", { user_id: user.id, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if ((active || []).length) return Response.json({ plan_id: active[0].id, already_enrolled: true });

    const now = new Date();
    const priceUsd = financePriceUsd({});   // founding price during the window, else sustainable

    // Grant Premium (loyalty_enrolled) — reuse/create the membership record.
    const existingMember = (await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[])[0];
    const memberPatch = {
      user_id: user.id,
      status: "active",
      loyalty_enrolled: true,
      enrolled_at: existingMember?.enrolled_at ?? now.toISOString(),
      financed: true,
      annual_agreement_at: now.toISOString(),
      renewal_due: false,
    };
    if (existingMember?.id) await db.update("PremiumPPCMembership", String(existingMember.id), memberPatch).catch(() => null);
    else await db.create("PremiumPPCMembership", memberPatch, user.id).catch(() => null);

    const plan = await db.create("PremiumFinancePlan", {
      user_id: user.id,
      cycle_start: dayKey(now),
      cycle_days: financeCycleDays(),
      price_usd: priceUsd,
      daily_usd: financeDailyUsd(),
      deducted_usd: 0,
      earning_days: 0,
      month_earnings_usd: 0,
      covered: false,
      qualified: false,
      status: "active",
      last_deduct_day: "",
      created_at: now.toISOString(),
    }, user.id);

    return Response.json({
      plan_id: plan.id,
      price_usd: priceUsd,
      daily_usd: financeDailyUsd(),
      cycle_days: financeCycleDays(),
      note: `No charge today. We hold $${financeDailyUsd().toFixed(2)}/day from your earnings toward your $${priceUsd.toFixed(2)} membership; whatever's left at month's end comes back to you as Site Cash. If you don't earn enough to cover it, you move to the free plan — no charge, no debt.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
