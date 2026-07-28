import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { tickAll, liveEnabled } from "../../sdk/live-experiments.ts";

// liveExperimentTick (INTERNAL/ADMIN, scheduled every few minutes) — the real-time monitor. For every
// running experiment it: measures live results, trips the circuit breaker on any guardrail breach
// (instant revert to control), shifts traffic toward the better arm (Thompson-style) and advances the
// canary cap when healthy, promotes a significant winner (early or at the 24h window) with no downtime,
// and expires inconclusive tests back to control.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await liveEnabled())) return Response.json({ success: true, skipped: "live experiments disabled" });
    const results = await tickAll();
    const summary = results.reduce((acc: Record<string, number>, r: any) => { acc[r.action] = (acc[r.action] || 0) + 1; return acc; }, {});
    return Response.json({ success: true, checked: results.length, summary, results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
