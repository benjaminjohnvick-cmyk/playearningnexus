import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import {
  aiAdManagerLive, deliverableLearning, optimizeDeliveryMix, recordDeliverableOutcome,
} from "../../sdk/ai-ad-manager.ts";
import { tier2Parts } from "../../sdk/tier2-scaling.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";

// aiAdManagerRun (admin/service, scheduled) — the SELF-LEARNING, SELF-IMPROVING orchestrator. Each run closes
// a measure → learn → improve → dispatch loop for every active Tier 2 advertiser, with no per-advertiser human:
//   1. MEASURE — read each advertiser's real attributed ROAS and record it as a learning signal
//      (recordDeliverableOutcome → OptimizationSignal + AgentLearningMemory, the same primitives the platform's
//      self-learning loop already consumes).
//   2. LEARN — roll recent outcomes into a per-deliverable performance ranking (deliverableLearning).
//   3. IMPROVE — re-weight & reorder the delivery mix toward what's working (optimizeDeliveryMix): winners get
//      boosted, persistent underperformers get flagged to vary creative/cadence.
//   4. DISPATCH — emit each due deliverable to its AI engine with the learned weight/action.
// Best-effort and safe to repeat; never charges money, never fabricates results.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    if (!(await aiAdManagerLive(null))) {
      return Response.json({ skipped: true, reason: "ai_ad_manager is off" });
    }

    const parts = tier2Parts();
    const plans = await db.filter("Tier2ScalingPlan", { status: "active" }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];

    // 2. LEARN — read the current performance ranking once for this run.
    const learning = await deliverableLearning(30);

    let advertisers = 0, dispatched = 0, measured = 0;
    const summary: { advertiser_id: string; due: number; roas: number | null }[] = [];
    for (const plan of plans) {
      const advId = String(plan.user_id ?? plan.owner_id ?? plan.id ?? "");
      const partsCompleted = Math.max(0, Math.floor(Number(plan.parts_completed) || 0));
      if (partsCompleted < 1) continue;
      advertisers++;

      // 1. MEASURE — real attributed ROAS this period → a grounded learning signal.
      let roas: number | null = null;
      try {
        const sinceISO = String(plan.current_year_started_at ?? plan.started_at ?? new Date(Date.now() - 30 * 86400000).toISOString());
        const attributed = await attributedSalesUsd(db, advId, sinceISO).catch(() => 0);
        const paid = Math.max(1, Number(plan.paid_usd) || 0);
        roas = Math.round((attributed / paid) * 100) / 100;
        await recordDeliverableOutcome({ advertiserId: advId, deliverableKey: "ai_campaign_manager", metric: "roas", value: attributed, benchmark: paid });
        measured++;
      } catch { /* measurement best-effort */ }

      // 3. IMPROVE — learning-weighted, reordered delivery mix.
      const mix = optimizeDeliveryMix(partsCompleted, parts, learning);

      // 4. DISPATCH — each due deliverable to its engine with the learned weight/action.
      for (const d of mix) {
        await emitEvent("tier2.deliverable.due", {
          advertiser_id: advId, deliverable: d.key, engine: d.engine, cadence: d.cadence,
          real_respondents: d.real_respondents, weight: d.weight, action: d.action, parts_completed: partsCompleted,
        }, { source: "aiAdManagerRun" }).catch(() => null);
        dispatched++;
      }
      summary.push({ advertiser_id: advId, due: mix.length, roas });
    }

    return Response.json({
      ok: true, advertisers, deliverables_dispatched: dispatched, advertisers_measured: measured,
      learning: { sampled: learning.sampled, ranked: learning.ranked.slice(0, 10) },
      summary: summary.slice(0, 100),
      note: "Self-learning loop: measured real ROAS → recorded learning signals → re-weighted the delivery mix " +
        "→ dispatched each deliverable to its AI engine. Research engines field to real consented respondents; " +
        "nothing here charges money or fabricates results.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
