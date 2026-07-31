import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { getNumber, getBool } from "../../sdk/settings.ts";
import { pointValueUsd, breakageRecognitionPct, catalogWholesaleFraction } from "../../sdk/revenue.ts";
import { sumExpenses } from "../../sdk/expenses.ts";
import { computeGrowthPlan, projectGrowth, type GrowthInputs } from "../../sdk/growth-engine.ts";

// growthBudgetReport (INTERNAL/ADMIN) — the self-sustaining growth flywheel on REAL cash, with the
// redemption reserve baked in so it never recommends spending money you need to honor points. Deterministic:
// every number comes from the RevenueEvent + Expense ledgers, User points, and points orders.
//   Body: { days?: number, project_months?: number }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(3650, Math.round(Number(body.days) || 30)));
    const projectMonths = Math.max(1, Math.min(60, Math.round(Number(body.project_months) || 12)));
    const cutoffMs = Date.now() - days * 86400000;

    // Revenue ledger → all-time + window, split revenue vs subsidy (subsidies are a cost).
    const events = await base44.asServiceRole.entities.RevenueEvent.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let revAll = 0, subAll = 0, revWin = 0, subWin = 0;
    for (const e of (events || [])) {
      const amt = Number(e.amount_usd) || 0;
      const at = e.at ? new Date(String(e.at)).getTime() : (e.created_date ? new Date(String(e.created_date)).getTime() : 0);
      const inWin = !at || at >= cutoffMs;
      if (e.kind === "subsidy") { subAll += amt; if (inWin) subWin += amt; }
      else { revAll += amt; if (inWin) revWin += amt; }
    }

    // Expense ledger → all-time + window (+ marketing subset for CAC).
    const expenses = await base44.asServiceRole.entities.Expense.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    const expAll = sumExpenses(expenses, 0);
    const expWin = sumExpenses(expenses, cutoffMs);

    // Users → total, new-in-window, outstanding points (spendable + locked).
    const users = await base44.asServiceRole.entities.User.filter({}, undefined, 50000).catch(() => []) as Record<string, unknown>[];
    let outstanding = 0, newUsers = 0;
    for (const u of (users || [])) {
      outstanding += (Number(u.points) || 0) + (Number(u.pending_cashback_points) || 0);
      const cd = u.created_date ? new Date(String(u.created_date)).getTime() : 0;
      if (cd && cd >= cutoffMs) newUsers++;
    }

    // Redeemed points (all-time + window) from points orders → drives the empirical redemption rate.
    const orders = await base44.asServiceRole.entities.Order.filter({ payment_method: "points" }, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let redAll = 0, redWin = 0;
    for (const o of (orders || [])) {
      const pts = Number(o.points_spent) || Number(o.points) || 0;
      redAll += pts;
      const at = o.created_at ? new Date(String(o.created_at)).getTime() : (o.created_date ? new Date(String(o.created_date)).getTime() : 0);
      if (at && at >= cutoffMs) redWin += pts;
    }

    const inputs: GrowthInputs = {
      revenueAllTimeUsd: revAll, subsidiesAllTimeUsd: subAll, expensesAllTimeUsd: expAll.total,
      revenueWindowUsd: revWin, subsidiesWindowUsd: subWin, expensesWindowUsd: expWin.total,
      marketingWindowUsd: expWin.marketing,
      outstandingPoints: outstanding, redeemedPointsAllTime: redAll, redeemedPointsWindow: redWin,
      totalUsers: (users || []).length, newUsersWindow: newUsers, windowDays: days,
      pointUsd: pointValueUsd(),
      wholesaleFraction: catalogWholesaleFraction(),
      breakageRecognitionPct: breakageRecognitionPct(),
      expectedRedemptionRateDefault: await getNumber("EXPECTED_REDEMPTION_RATE", 0.6),
      reserveSafetyBuffer: await getNumber("GROWTH_RESERVE_SAFETY_PCT", 0.15),
      reinvestPct: await getNumber("GROWTH_REINVEST_PCT", 0.7),
      loopActive: await getBool("GROWTH_LOOP_ACTIVE", true),
      ltvYears: await getNumber("GROWTH_LTV_YEARS", 3),
      maxUsersTarget: Math.round(await getNumber("GROWTH_MAX_USERS_TARGET", 0)),
    };

    const plan = computeGrowthPlan(inputs);
    const projection = projectGrowth(plan, inputs, projectMonths);

    return Response.json({
      window_days: days,
      plan,
      projection,
      inputs_echo: {
        point_value_usd: inputs.pointUsd, wholesale_fraction: inputs.wholesaleFraction,
        breakage_recognition_pct: inputs.breakageRecognitionPct, expected_redemption_rate_default: inputs.expectedRedemptionRateDefault,
        reserve_safety_buffer: inputs.reserveSafetyBuffer, reinvest_pct: inputs.reinvestPct, ltv_years: inputs.ltvYears,
        total_users: inputs.totalUsers, new_users_window: inputs.newUsersWindow,
      },
      disclaimer: "estimated_cash_usd is an ESTIMATE from the recorded revenue/expense ledgers — reconcile against your real bank balance. Points are non-cashable closed-loop credit; nothing here converts points to cash. Not financial or legal advice.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
