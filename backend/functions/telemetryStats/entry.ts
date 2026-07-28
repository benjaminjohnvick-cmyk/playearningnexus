import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { aggregateStats, pruneTelemetry } from "../../sdk/telemetry.ts";

// telemetryStats (INTERNAL/ADMIN) — compute the statistical breakdown of interaction telemetry
// (event distribution, top pages, catalog funnel rates, scroll depth, drop-off) and publish the
// headline metrics as OptimizationSignal rows so the site model + self-learning loop consume them.
// Body: { days?: number, prune?: boolean }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(90, Number(body?.days) || 14));
    const stats = await aggregateStats(days, true);
    let pruned = 0;
    if (body?.prune) pruned = await pruneTelemetry();
    return Response.json({ success: true, days, pruned, ...stats });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
