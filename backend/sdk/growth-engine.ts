// growth-engine.ts — the self-sustaining growth flywheel, on REAL cash, with a REDEMPTION RESERVE that
// keeps you from ever spending money you need to honor outstanding points.
//
// THE MODEL (all funded by operations/advertising — never by new users' money, so it isn't a scheme):
//   • Real cash in = the RevenueEvent ledger (advertisers, subscriptions, spreads …). You keep 100% of it.
//   • Points are a closed-loop engagement currency, NON-CASHABLE. Issuing them costs ~nothing.
//   • You never pay out the full face value of points issued, because:
//       – Breakage: some points are never redeemed → retained value (recognized conservatively).
//       – Spread : redeemed points buy catalog goods where you keep (face − wholesale).
//     Together these are the "capture" of value you handed users — the honest recapture, not points→cash.
//   • THE GUARDRAIL: before any surplus is called profit or reinvested, you RESERVE enough cash to honor
//     the points you actually expect to be redeemed (at what they cost YOU — wholesale, not face). Only the
//     cash ABOVE that reserve is free. This is what stops the flywheel from becoming insolvent.
//   • Free surplus → split between reinvestment (marketing → more users → more advertiser cash) and profit.
//     Flip the loop OFF (or hit a max-users target) and 100% of free surplus becomes take-home profit.
//
// Nothing here converts points to cash. The owner's money is the real advertiser/operations cash + the
// recaptured breakage/spread — which are already the platform's.

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface GrowthInputs {
  // Cash (USD), real, from the ledger + expense log.
  revenueAllTimeUsd: number;      // cumulative RevenueEvent kind="revenue"
  subsidiesAllTimeUsd: number;    // cumulative RevenueEvent kind="subsidy" (perks — a cost)
  expensesAllTimeUsd: number;     // cumulative Expense (marketing + infra + other)
  revenueWindowUsd: number;       // revenue in the reporting window
  subsidiesWindowUsd: number;
  expensesWindowUsd: number;
  marketingWindowUsd: number;     // marketing subset of window expenses (for CAC)
  // Points (closed-loop liability).
  outstandingPoints: number;      // sum of User.points (+ locked buckets) — the redemption obligation
  redeemedPointsAllTime: number;  // points already spent (Order.points_spent) — for the redemption rate
  redeemedPointsWindow: number;
  // Users.
  totalUsers: number;
  newUsersWindow: number;
  windowDays: number;
  // Knobs.
  pointUsd: number;               // $ value of one point (face)
  wholesaleFraction: number;      // cost to honor a redeemed point = pointUsd × this (spread = 1 − this)
  breakageRecognitionPct: number; // fraction of the never-redeemed pile recognized as retained value
  expectedRedemptionRateDefault: number; // used before there's redemption history
  reserveSafetyBuffer: number;    // extra cushion on the reserve (e.g. 0.15 = +15%)
  reinvestPct: number;            // share of FREE surplus reinvested into growth (rest = profit)
  loopActive: boolean;            // false → stop reinvesting, take all free surplus as profit
  ltvYears: number;               // horizon for a simple LTV
  maxUsersTarget: number;         // 0 = no cap; else stop reinvesting once reached ("break the loop")
}

/** Estimated cash position from the ledger (an ESTIMATE — reconcile against the real bank balance). */
export function estimatedCashUsd(i: GrowthInputs): number {
  return r2(i.revenueAllTimeUsd - i.subsidiesAllTimeUsd - i.expensesAllTimeUsd);
}

/** Redemption rate: from history if there's enough, else the configured default. Bounded to [0,1]. */
export function redemptionRate(i: GrowthInputs): number {
  const everIssuedProxy = i.outstandingPoints + i.redeemedPointsAllTime;
  if (everIssuedProxy >= 1000 && i.redeemedPointsAllTime > 0) {
    return clamp(i.redeemedPointsAllTime / everIssuedProxy, 0, 1);
  }
  return clamp(i.expectedRedemptionRateDefault, 0, 1);
}

/** The cash you must hold to honor the points you EXPECT to be redeemed — at what they cost you (wholesale),
 *  plus a safety buffer. This is the money the engine will never let you spend. */
export function redemptionReserveUsd(i: GrowthInputs): number {
  const rate = redemptionRate(i);
  const costPerPoint = i.pointUsd * clamp(i.wholesaleFraction, 0, 1);
  const base = Math.max(0, i.outstandingPoints) * rate * costPerPoint;
  return r2(base * (1 + Math.max(0, i.reserveSafetyBuffer)));
}

/** Recognized breakage: value of points expected to NEVER be redeemed, taken conservatively. */
export function recognizedBreakageUsd(i: GrowthInputs): number {
  const neverRedeemed = Math.max(0, i.outstandingPoints) * (1 - redemptionRate(i));
  return r2(neverRedeemed * i.pointUsd * clamp(i.breakageRecognitionPct, 0, 1));
}

/** Spread you keep on points redeemed in the window (face − wholesale on catalog goods). */
export function spreadRecaptureWindowUsd(i: GrowthInputs): number {
  const spreadPerPoint = i.pointUsd * (1 - clamp(i.wholesaleFraction, 0, 1));
  return r2(Math.max(0, i.redeemedPointsWindow) * spreadPerPoint);
}

/** How much of the point value you issue you recover via breakage + spread (the "capture the users' half"). */
export function captureRatePct(i: GrowthInputs): number {
  const issuedValue = Math.max(1, (i.outstandingPoints + i.redeemedPointsAllTime) * i.pointUsd);
  const recovered = recognizedBreakageUsd(i) + r2(Math.max(0, i.redeemedPointsAllTime) * i.pointUsd * (1 - clamp(i.wholesaleFraction, 0, 1)));
  return r2((recovered / issuedValue) * 100);
}

export interface GrowthPlan {
  estimated_cash_usd: number;
  redemption_reserve_usd: number;
  reserve_shortfall_usd: number;     // > 0 → you're UNDER-reserved: do NOT reinvest, top up first
  free_surplus_usd: number;          // cash above the reserve — the only money that's safe to move
  reinvest_usd: number;              // → marketing (0 if loop off / under-reserved / max users hit)
  profit_usd: number;                // → take-home / retained
  window: {
    revenue_usd: number; subsidies_usd: number; expenses_usd: number; net_operating_usd: number;
    recognized_breakage_usd: number; spread_recapture_usd: number;
  };
  points: { outstanding: number; outstanding_face_usd: number; redemption_rate: number; capture_rate_pct: number };
  unit: { cac_usd: number; contribution_margin_per_user_annual_usd: number; ltv_usd: number; payback_months: number; new_users_affordable: number };
  loop_active: boolean;
  max_users_target: number;
  reserve_ok: boolean;
  notes: string[];
}

/** Assemble the full plan from inputs. Pure + deterministic — the report and the auto-planner both use it. */
export function computeGrowthPlan(i: GrowthInputs): GrowthPlan {
  const notes: string[] = [];
  const cash = estimatedCashUsd(i);
  const reserve = redemptionReserveUsd(i);
  const shortfall = Math.max(0, r2(reserve - cash));
  const freeSurplus = Math.max(0, r2(cash - reserve));

  const netOperating = r2(i.revenueWindowUsd - i.subsidiesWindowUsd - i.expensesWindowUsd);
  const breakage = recognizedBreakageUsd(i);
  const spread = spreadRecaptureWindowUsd(i);

  // Unit economics (annualized from the window).
  const yearFrac = Math.max(1 / 365, i.windowDays / 365);
  const cac = i.newUsersWindow > 0 ? r2(i.marketingWindowUsd / i.newUsersWindow) : 0;
  const perUserWindowMargin = i.totalUsers > 0 ? (i.revenueWindowUsd - i.subsidiesWindowUsd) / i.totalUsers : 0;
  const perUserAnnualMargin = r2(perUserWindowMargin / yearFrac);
  const ltv = r2(perUserAnnualMargin * Math.max(0, i.ltvYears));
  const perUserMonthlyMargin = perUserAnnualMargin / 12;
  const payback = perUserMonthlyMargin > 0 && cac > 0 ? r2(cac / perUserMonthlyMargin) : 0;

  // Reinvest/profit split — only from FREE surplus, and only when the loop is on, reserve is met, and we
  // haven't hit the max-users target. Otherwise everything free is profit (take it out / "break the loop").
  const maxHit = i.maxUsersTarget > 0 && i.totalUsers >= i.maxUsersTarget;
  const canReinvest = i.loopActive && shortfall <= 0 && !maxHit;
  const reinvest = canReinvest ? r2(freeSurplus * clamp(i.reinvestPct, 0, 1)) : 0;
  const profit = r2(freeSurplus - reinvest);
  const newUsersAffordable = cac > 0 ? Math.floor(reinvest / cac) : 0;

  if (shortfall > 0) notes.push(`UNDER-RESERVED by $${shortfall.toFixed(2)} — hold new marketing spend until the reserve is funded; the points you owe come first.`);
  if (!i.loopActive) notes.push("Growth loop is OFF — all free surplus is booked as profit, none reinvested.");
  if (maxHit) notes.push(`Max-users target (${i.maxUsersTarget.toLocaleString()}) reached — loop paused; free surplus is profit.`);
  if (cac === 0) notes.push("No CAC yet (no marketing spend or no new users in the window) — log marketing expenses to project a growth budget.");
  if (ltv > 0 && cac > 0 && ltv < cac) notes.push(`LTV ($${ltv.toFixed(2)}) is below CAC ($${cac.toFixed(2)}) — acquisition isn't paying back yet; don't scale spend until it does.`);

  return {
    estimated_cash_usd: cash,
    redemption_reserve_usd: reserve,
    reserve_shortfall_usd: shortfall,
    free_surplus_usd: freeSurplus,
    reinvest_usd: reinvest,
    profit_usd: profit,
    window: {
      revenue_usd: r2(i.revenueWindowUsd), subsidies_usd: r2(i.subsidiesWindowUsd), expenses_usd: r2(i.expensesWindowUsd),
      net_operating_usd: netOperating, recognized_breakage_usd: breakage, spread_recapture_usd: spread,
    },
    points: {
      outstanding: Math.round(i.outstandingPoints),
      outstanding_face_usd: r2(i.outstandingPoints * i.pointUsd),
      redemption_rate: r2(redemptionRate(i)),
      capture_rate_pct: captureRatePct(i),
    },
    unit: {
      cac_usd: cac, contribution_margin_per_user_annual_usd: perUserAnnualMargin, ltv_usd: ltv,
      payback_months: payback, new_users_affordable: newUsersAffordable,
    },
    loop_active: i.loopActive,
    max_users_target: i.maxUsersTarget,
    reserve_ok: shortfall <= 0,
    notes,
  };
}

/** A simple forward projection: reinvest → new users → more revenue → bigger budget, compounding monthly,
 *  capped at the max-users target (where the loop "breaks" and surplus flips fully to profit). Deterministic;
 *  a planning aid, not a promise. Assumes today's per-user margin, CAC, and reinvest rate hold. */
export function projectGrowth(plan: GrowthPlan, i: GrowthInputs, months: number): Array<{ month: number; users: number; annual_revenue_usd: number; marketing_budget_usd: number; profit_usd: number }> {
  const out: Array<{ month: number; users: number; annual_revenue_usd: number; marketing_budget_usd: number; profit_usd: number }> = [];
  const perUserAnnual = plan.unit.contribution_margin_per_user_annual_usd;
  const cac = plan.unit.cac_usd;
  const reinvestPct = clamp(i.reinvestPct, 0, 1);
  let users = Math.max(0, i.totalUsers);
  const cap = i.maxUsersTarget > 0 ? i.maxUsersTarget : Infinity;
  const m = clamp(Math.round(months), 1, 60);
  for (let month = 1; month <= m; month++) {
    const monthlyMargin = (users * perUserAnnual) / 12;
    const looping = i.loopActive && users < cap && cac > 0;
    const budget = looping ? r2(monthlyMargin * reinvestPct) : 0;
    const profit = r2(monthlyMargin - budget);
    const added = looping && cac > 0 ? Math.floor(budget / cac) : 0;
    users = Math.min(cap, users + added);
    out.push({ month, users: Math.round(users), annual_revenue_usd: r2(users * perUserAnnual), marketing_budget_usd: budget, profit_usd: profit });
  }
  return out;
}
