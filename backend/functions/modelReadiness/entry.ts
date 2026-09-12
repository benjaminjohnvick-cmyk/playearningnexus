import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { modelTrainingEnabled, modelReadiness } from "../../sdk/model-training.ts";

// modelReadiness (admin/internal) — READ-ONLY counts of how ready the collected first-party data is to train a
// custom model one day: total + labeled examples, breakdown by type and domain, and a headline readiness %.
// No example content leaves here (counts only), so it's always safe to show on the coverage dashboard.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!modelTrainingEnabled()) return Response.json({ ok: true, enabled: false, note: "Model-training data pipeline is OFF." });
    const readiness = await modelReadiness();
    return Response.json({ ok: true, enabled: true, ...readiness });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
