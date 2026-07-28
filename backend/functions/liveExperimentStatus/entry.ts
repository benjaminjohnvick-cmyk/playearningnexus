import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { measureExperiment } from "../../sdk/live-experiments.ts";

// liveExperimentStatus (INTERNAL/ADMIN) — dashboard data: every experiment with its live measurement
// (per-arm rates, significance, probability the variant is better, guardrail health, traffic share,
// canary stage). Powers the real-time monitoring view.
// Body: { status?: "running"|"promoted"|"reverted"|"halted"|"all", limit? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const want = body?.status && body.status !== "all" ? { status: body.status } : {};
    const limit = Math.max(1, Math.min(200, Number(body?.limit) || 50));
    const exps = await db.filter("LiveExperiment", want, "-started_at", limit).catch(() => []) as any[];

    const rows = [];
    for (const exp of exps) {
      let measured = null;
      if (exp.status === "running") measured = await measureExperiment(exp).catch(() => null);
      rows.push({
        id: exp.id, key: exp.key, type: exp.type, status: exp.status,
        control_value: exp.control_value, variant_value: exp.variant_value,
        objective_metric: exp.objective_metric, variant_share: exp.variant_share,
        canary_stage: `${(exp.canary_idx || 0) + 1}/${(exp.canary_caps || [1]).length}`,
        started_at: exp.started_at, window_hours: exp.window_hours, decision: exp.decision || null,
        live: measured || exp.stats || null,
      });
    }
    return Response.json({ success: true, count: rows.length, experiments: rows });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
