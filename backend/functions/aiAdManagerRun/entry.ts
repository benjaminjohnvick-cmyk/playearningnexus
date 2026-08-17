import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import { dispatchManifest, aiAdManagerLive } from "../../sdk/ai-ad-manager.ts";
import { tier2Parts } from "../../sdk/tier2-scaling.ts";

// aiAdManagerRun (admin/service, scheduled) — the self-serve orchestrator. For every ACTIVE Tier 2 advertiser
// it computes the A-D deliverables that are due and DISPATCHES each to its mapped AI engine by emitting a
// `tier2.deliverable.due` domain event (the existing schedulers/agents that own each engine consume it).
// No per-advertiser human labor, near-zero marginal cost. Best-effort and idempotent-per-run: emitting a due
// signal is safe to repeat. Returns a manifest of what was dispatched.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Allow headless/service-role scheduled calls; block non-admin user calls.
    if (user && user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    if (!(await aiAdManagerLive(null))) {
      return Response.json({ skipped: true, reason: "ai_ad_manager is off" });
    }

    const parts = tier2Parts();
    const plans = await db.filter("Tier2ScalingPlan", { status: "active" }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];

    let advertisers = 0, dispatched = 0;
    const summary: { advertiser_id: string; due: number }[] = [];
    for (const plan of plans) {
      const advId = String(plan.user_id ?? plan.owner_id ?? plan.id ?? "");
      const partsCompleted = Math.max(0, Math.floor(Number(plan.parts_completed) || 0));
      const manifest = dispatchManifest(partsCompleted, parts);
      if (!manifest.length) continue;
      advertisers++;
      for (const d of manifest) {
        await emitEvent("tier2.deliverable.due", {
          advertiser_id: advId, deliverable: d.key, engine: d.engine,
          cadence: d.cadence, real_respondents: d.real_respondents, parts_completed: partsCompleted,
        }, { source: "aiAdManagerRun" }).catch(() => null);
        dispatched++;
      }
      summary.push({ advertiser_id: advId, due: manifest.length });
    }

    return Response.json({
      ok: true, advertisers, deliverables_dispatched: dispatched,
      summary: summary.slice(0, 100),
      note: "Each due deliverable was dispatched to its AI engine via a tier2.deliverable.due event. Research " +
        "engines field to real consented respondents; nothing here charges money or fabricates results.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
