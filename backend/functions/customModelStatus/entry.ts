import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { runShadowEval, accuracyTrend } from "../../sdk/model-eval.ts";
import { modelBackend, modelShadowEnabled } from "../../sdk/custom-model.ts";

// customModelStatus (admin/internal) — READ: your custom model's current accuracy AGAINST the incumbent AI,
// the readiness verdict (ready only when it matches the incumbent at target), the per-domain breakdown, the
// active backend, and the accuracy trend. Read-only; does not write a snapshot (customModelEval does that).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const [result, trend] = await Promise.all([runShadowEval(), accuracyTrend(60)]);
    return Response.json({ ok: true, shadow_enabled: modelShadowEnabled(), backend: modelBackend(), ...result, trend });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
