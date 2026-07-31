import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { InvokeLLM } from "../../sdk/integrations.ts";

// growthBudgetAutoPlan (INTERNAL/ADMIN, scheduled daily) — the AI that "keeps track of expenses and plans
// for an increasing budget." It runs the deterministic growthBudgetReport, stores a dated GrowthPlan
// snapshot, RAISES AN ALERT if the redemption reserve is underfunded (so you never spend money you owe to
// points), and writes a short plain-English recommendation. The numbers are computed, not guessed — the AI
// only narrates them.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);

    // Deterministic numbers first.
    const rep = await base44.asServiceRole.functions.invoke("growthBudgetReport", { days: 30, project_months: 12 }).catch(() => null);
    const data = (rep as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    const plan = data?.plan as Record<string, unknown> | undefined;
    if (!plan) return Response.json({ error: "Could not compute the growth plan." }, { status: 500 });

    const underReserved = (Number(plan.reserve_shortfall_usd) || 0) > 0;

    // Optional plain-English narrative (cheap tier; never blocks on cost/keys).
    let narrative = "";
    try {
      const r = await InvokeLLM({
        model: "gpt_5_mini",
        prompt: `You are a startup CFO. In 3-4 sentences, plainly summarize this month's growth budget and what to do. ` +
          `Be direct about the redemption reserve — if under-reserved, say fund it before any new marketing. Do NOT invent numbers; use only these:\n` +
          JSON.stringify({
            estimated_cash_usd: plan.estimated_cash_usd, redemption_reserve_usd: plan.redemption_reserve_usd,
            reserve_shortfall_usd: plan.reserve_shortfall_usd, free_surplus_usd: plan.free_surplus_usd,
            reinvest_usd: plan.reinvest_usd, profit_usd: plan.profit_usd, unit: plan.unit, loop_active: plan.loop_active,
          }),
      });
      narrative = String((r as Record<string, unknown>)?.text || (r as Record<string, unknown>)?.output || "").slice(0, 1200);
    } catch { /* narrative is a bonus; the numbers stand on their own */ }

    const snapshot = {
      at: new Date().toISOString(),
      window_days: 30,
      estimated_cash_usd: plan.estimated_cash_usd,
      redemption_reserve_usd: plan.redemption_reserve_usd,
      reserve_shortfall_usd: plan.reserve_shortfall_usd,
      free_surplus_usd: plan.free_surplus_usd,
      reinvest_usd: plan.reinvest_usd,
      profit_usd: plan.profit_usd,
      capture_rate_pct: (plan.points as Record<string, unknown>)?.capture_rate_pct ?? null,
      cac_usd: (plan.unit as Record<string, unknown>)?.cac_usd ?? null,
      ltv_usd: (plan.unit as Record<string, unknown>)?.ltv_usd ?? null,
      loop_active: plan.loop_active,
      reserve_ok: plan.reserve_ok,
      alert: underReserved,
      notes: plan.notes || [],
      projection: data?.projection || [],
      narrative,
    };
    await base44.asServiceRole.entities.GrowthPlan.create(snapshot).catch(() => null);

    // Alert admins when the reserve is at risk (append-only audit + best-effort notify).
    if (underReserved) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        type: "growth_reserve_alert",
        message: `Redemption reserve is UNDER-funded by $${Number(plan.reserve_shortfall_usd).toFixed(2)}. Hold new marketing spend until it's topped up.`,
        at: new Date().toISOString(),
      }).catch(() => null);
    }

    return Response.json({ success: true, alert: underReserved, snapshot });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
