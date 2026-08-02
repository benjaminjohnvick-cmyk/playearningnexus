import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { primeSettings } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd, recordSubsidy } from "../../sdk/revenue.ts";
import { earnRateUsdPerMin } from "../../sdk/earn-rate.ts";
import { monthKey, dayKey, premiumHeadroomUsd, addGlobalIssued, eligibility } from "../../sdk/earn-back.ts";

// earnBackCredit (internal/admin) — apply completed survey minutes toward a member's active earn-back plan.
// Called by the survey-completion flow. Credits Site Cash (closed-loop points), advances the plan, and for
// PREMIUM records the subsidy + the global monthly kill-switch counter. Enforces: per-item target, premium
// monthly cap, global kill-switch. Grace/pause NEVER claws back banked discount — it only gates NEW earning.
//   Body: { user_id, minutes, plan_id? }  → { credited_usd, earned_usd, ownership_pct, status, throttled }
export default __handler(async (req) => {
  const guard = await requireInternalOrAdmin(req);
  if (guard) return guard;
  try {
    await primeSettings();
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "");
    const minutes = Math.max(0, Number(body.minutes) || 0);
    if (!userId || minutes <= 0) return Response.json({ error: "user_id and minutes required" }, { status: 400 });

    // Resolve the plan: explicit id, else the member's newest active plan.
    let plan: Record<string, unknown> | null = null;
    if (body.plan_id) plan = await db.get("EarnBackPlan", String(body.plan_id)).catch(() => null) as Record<string, unknown> | null;
    else {
      const rows = await db.filter("EarnBackPlan", { user_id: userId, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      plan = rows?.[0] || null;
    }
    if (!plan || plan.status !== "active") return Response.json({ ok: true, credited_usd: 0, note: "No active earn-back plan." });
    if (plan.user_id !== userId) return Response.json({ error: "Plan does not belong to this user." }, { status: 403 });

    const now = new Date();
    const today = dayKey(now);
    const thisMonth = monthKey(now);
    const premium = !!plan.is_premium;

    // Month rollover: reset the monthly earned tally + grace at the start of a new month.
    let graceUsed = Number(plan.grace_used) || 0;
    let earnedThisMonth = Number(plan.earned_this_month_usd) || 0;
    if (plan.month !== thisMonth) { graceUsed = 0; earnedThisMonth = 0; }

    // Count missed days since last activity (a lapse spends grace). Consecutive days = 0 missed.
    const last = String(plan.last_active_day || today);
    const gapDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000);
    const missed = Math.max(0, gapDays - 1);
    if (plan.month === thisMonth) graceUsed += missed;   // only accrue within the same month
    const elig = eligibility({ activeToday: true, graceUsed });   // crediting = active now

    // Dollar value of this survey time at the tier rate, clamped to what's left of the target.
    const rate = earnRateUsdPerMin(premium);
    const remainingTarget = Math.max(0, (Number(plan.discount_target_usd) || 0) - (Number(plan.earned_usd) || 0));
    let creditUsd = Math.min(minutes * rate, remainingTarget);

    // Premium subsidy is bounded: min(member monthly remaining, global kill-switch remaining).
    let throttled = false;
    if (premium && creditUsd > 0) {
      const head = await premiumHeadroomUsd(userId, thisMonth);
      if (creditUsd > head.allowed) { creditUsd = Math.max(0, head.allowed); throttled = true; }
    }
    creditUsd = Math.round(creditUsd * 100) / 100;

    // Credit Site Cash (points) for the earned portion. Non-withdrawable, spends only on-site.
    if (creditUsd > 0) {
      const points = Math.round(creditUsd / pointValueUsd());
      if (points > 0) await adjustUserBalance(userId, points, { field: "points" });
      if (premium) {
        await recordSubsidy({ type: "earnback_subsidy", amount_usd: creditUsd, user_id: userId, funded_by: "operator_growth_budget", meta: { plan_id: plan.id, month: thisMonth } });
        await addGlobalIssued(creditUsd, thisMonth);
      }
    }

    const earnedUsd = Math.round(((Number(plan.earned_usd) || 0) + creditUsd) * 100) / 100;
    const price = Number(plan.item_price_usd) || 0;
    const ownershipPct = price > 0 ? Math.min(100, Math.round((earnedUsd / price) * 10000) / 100) : 0;
    const done = earnedUsd >= (Number(plan.discount_target_usd) || 0) - 0.005;

    await db.update("EarnBackPlan", plan.id as string, {
      earned_usd: earnedUsd,
      earned_this_month_usd: Math.round((earnedThisMonth + creditUsd) * 100) / 100,
      minutes_done: (Number(plan.minutes_done) || 0) + minutes,
      ownership_pct: ownershipPct,
      month: thisMonth,
      grace_used: graceUsed,
      last_active_day: today,
      status: done ? "completed" : "active",
    });

    return Response.json({
      ok: true,
      credited_usd: creditUsd,
      earned_usd: earnedUsd,
      discount_target_usd: Number(plan.discount_target_usd) || 0,
      ownership_pct: ownershipPct,
      status: done ? "completed" : "active",
      throttled,
      grace_left: elig.grace_left,
      note: throttled ? "Premium earn-back is capped for now (monthly or platform limit reached); it resumes next month." : undefined,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
