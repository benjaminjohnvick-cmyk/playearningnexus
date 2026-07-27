import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { runOptimizationPass } from "../../sdk/optimizer.ts";

// aiOptimizerRun (INTERNAL/ADMIN, scheduled daily) — one full self-learning optimization cycle over
// EVERY optimizable setting: collect signals → measure past outcomes (keep wins, revert losses) →
// recommend → auto-apply non-sensitive within bounds, queue money/legal-sensitive for approval.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const report = await runOptimizationPass({});
    return Response.json({ success: true, ...report });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
