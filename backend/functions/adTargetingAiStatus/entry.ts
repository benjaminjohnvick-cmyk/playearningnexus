import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { aiTargetingEnabled, aiTargetingKill, aiTargetingActive, aiTargetingAutonomy, aiTargetingMinSample, loadTargetingModel, summarizeModel } from "../../sdk/ad-targeting-ai.ts";

// adTargetingAiStatus — admin READ of the self-learning ad-targeting layer: whether it's enabled/killed, its
// autonomy cap, and a summary of the current learned model (how many creatives, top-performing cohorts). The
// model only biases relevance ranking and produces advisory recommendations; it never changes an advertiser's
// chosen targeting or introduces sensitive attributes (permanent gate).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const model = await loadTargetingModel(db).catch(() => null);
    return Response.json({
      ok: true,
      enabled: aiTargetingEnabled(),
      kill_switch: aiTargetingKill(),
      active: aiTargetingActive(),
      autonomy: aiTargetingAutonomy(),
      min_sample: aiTargetingMinSample(),
      model: summarizeModel(model),
      note: "Self-learning relevance layer. Biases the ORDER of matching ads by learned cohort affinity and recommends cohort refinements; never excludes an ad, never changes an advertiser's contracted targeting, never targets an individual or a sensitive attribute. Run adTargetingLearn to (re)build the model. Not legal advice.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
