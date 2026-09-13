import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { runOptimizationPass } from "../../sdk/optimizer.ts";
import {
  resolvePolicy, computeAgreement, autonomyDecision, currentThresholds, autonomyKillSwitch, autonomyAutoOkDefault,
} from "../../sdk/autonomy-kernel.ts";
import { perfAutoOptimizeEnabled, perfMonitoringEnabled, perfReport } from "../../sdk/perf-optimizer.ts";

// perfOptimize (admin/internal, scheduled) — the AI keeping load times under the ~80ms perception budget, on the
// EXISTING optimizer's convention: it runs a normal optimization pass restricted to the load-speed knob
// (PERF_PREFETCH_LEVEL), which auto-applies within bounds and reverts on regression exactly like every other
// non-price knob. Every resulting change is ALSO recorded as an AutonomyDecision in the "load_time" domain — so
// load-time optimization flows through the same decision stream as the rest of the AI, which means it feeds the
// CUSTOM model's training data AND shows up as a "function" in the function-by-function switch gate. Load-time is
// non-sensitive (never money/identity/legal), so it auto-approves under the auto_ok autonomy policy.
const ACTOR = "system@getgoodsgratis.local";
const DOMAIN = "load_time";

export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!perfMonitoringEnabled()) return Response.json({ ok: true, note: "Load-speed monitoring is OFF (PERF_MONITORING_ENABLED)." });
    if (!perfAutoOptimizeEnabled()) {
      // Still return the current budget picture even when auto-optimize is paused.
      const report = await perfReport();
      return Response.json({ ok: true, auto_optimize: false, ...report, note: "AI load-time auto-optimization is OFF (PERF_AUTO_OPTIMIZE_ENABLED)." });
    }

    // 1) The existing AI optimizes the load-speed knob (collect p75 → propose → apply/queue → revert on regression).
    const pass = await runOptimizationPass({ only: ["PERF_PREFETCH_LEVEL"], measure: true });
    const changes = [
      ...((pass.auto_applied as any[]) || []),
      ...((pass.pending_approval as any[]) || []),
      ...((pass.in_experiment as any[]) || []),
    ].filter((c) => c && c.key === "PERF_PREFETCH_LEVEL");

    // 2) Record each change as a load_time decision on the standard autonomy convention (feeds both models).
    const now = new Date().toISOString();
    let decisions = 0;
    for (const c of changes) {
      const [override, priorDecisions, fbCount] = await Promise.all([
        db.filter("AutonomyDomain", { domain_id: DOMAIN }, "-created_at", 1).catch(() => []) as Promise<Record<string, unknown>[]>,
        db.filter("AutonomyDecision", { domain: DOMAIN }, "-created_at", 2000).catch(() => []) as Promise<Record<string, unknown>[]>,
        db.count("FeedbackEvent", { domain: DOMAIN }).catch(() => 0),
      ]);
      const policy = resolvePolicy(DOMAIN, override?.[0]?.mode as string | undefined, autonomyAutoOkDefault());
      const agree = computeAgreement((priorDecisions || []).map((r) => ({ decided: String(r.decided ?? ""), tweaked: r.tweaked === true, auto_approved: r.auto_approved === true })));
      const dataSample = (Number(fbCount) || 0) + (priorDecisions?.length || 0);
      const decision = autonomyDecision(policy, { approvedRuns: agree.approvedRuns, agreementRate: agree.agreementRate, dataSample }, currentThresholds(), autonomyKillSwitch());
      await db.create("AutonomyDecision", {
        domain: DOMAIN, subject_id: "PERF_PREFETCH_LEVEL",
        proposal: { key: c.key, from: c.from, to: c.to, objective: "route_nav_p75_ms", goal: "min", status: c.status },
        stage: decision.auto_approve ? "approved" : "awaiting_approval",
        auto_approved: decision.auto_approve, decided: decision.auto_approve ? "approved" : null, tweaked: false,
        mode: policy.mode, reason: decision.reason, permanent_gate: policy.permanent_gate,
        created_at: now, updated_at: now,
      }, ACTOR).catch(() => null);
      decisions++;
    }

    const report = await perfReport();
    return Response.json({
      ok: true, auto_optimize: true, changes_applied: changes.length, decisions_recorded: decisions,
      changes, ...report,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
