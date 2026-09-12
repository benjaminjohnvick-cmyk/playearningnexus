import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { runAndRecordEval } from "../../sdk/model-eval.ts";
import { modelShadowEnabled } from "../../sdk/custom-model.ts";

// customModelEval (admin/internal, scheduled) — runs one step of the accuracy-vs-incumbent evaluation and
// RECORDS the accuracy as a trend point. This is the "step by step, as data comes in" measurement: each run
// re-trains on the older data and scores the newer decisions against the incumbent AI's actual labels, so the
// model's readiness is continuously re-measured as the platform accumulates more data.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!modelShadowEnabled()) return Response.json({ ok: true, shadow_enabled: false, note: "Shadow evaluation is OFF (MODEL_SHADOW_ENABLED)." });
    const r = await runAndRecordEval();
    return Response.json({ ok: true, shadow_enabled: true, ...r });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
