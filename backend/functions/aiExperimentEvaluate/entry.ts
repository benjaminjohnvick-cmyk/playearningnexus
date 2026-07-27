import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { evaluateExperiments } from "../../sdk/experiments.ts";

// aiExperimentEvaluate (INTERNAL/ADMIN, scheduled) — evaluate change-gating experiments that have
// collected enough customer feedback (or timed out) and apply the winners; archive the losers.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const results = await evaluateExperiments();
    return Response.json({ success: true, evaluated: results.length, results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
