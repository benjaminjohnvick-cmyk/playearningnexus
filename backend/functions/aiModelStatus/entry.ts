import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { modelRoutingSummary } from "../../sdk/ai-models.ts";
import { primeSettings } from "../../sdk/settings.ts";

// aiModelStatus — admin READ of the swappable AI-model module: the model registry (including the frontier
// model, e.g. GPT-6 Astra), the effective JOB→model routing (with any admin overrides), the active provider /
// gateway, and whether the frontier tier can actually run right now (AI_FORCE_CHEAP_TIER off). This is the
// single place to see "which model runs which job" without reading code. Read-only; changes are made via
// settings (LLM_PROVIDER, AI_JOB_MODEL_<JOB>, AI_FORCE_CHEAP_TIER, GATEWAY_MODEL_*). Not legal advice.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    await primeSettings().catch(() => {});
    return Response.json({
      ok: true,
      ...modelRoutingSummary(),
      note: "Swappable model registry + per-job routing. Add a future model as one row in ai-models.ts; point a " +
        "job at it with AI_JOB_MODEL_<JOB>. Set LLM_PROVIDER=gateway (AI_GATEWAY_URL) to reach every company's " +
        "models through one unified API and bump ids as new models ship. The frontier tier (Astra) only runs when " +
        "AI_FORCE_CHEAP_TIER is OFF — otherwise every job transparently runs on the cheap tier and cost stays capped.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
