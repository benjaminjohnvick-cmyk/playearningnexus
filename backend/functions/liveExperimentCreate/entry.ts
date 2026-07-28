import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { createLiveExperiment, liveEnabled } from "../../sdk/live-experiments.ts";
import { getDef } from "../../sdk/settings.ts";
import { COMPLIANCE_DENYLIST } from "../../sdk/optimizer.ts";

// liveExperimentCreate (INTERNAL/ADMIN) — open a live A/B holdout for a NON-SENSITIVE change. Money and
// compliance settings are refused here: they never auto-promote and must go through the human-gated
// recommendation path instead.
// Body: { key, type?: "setting"|"flag"|"ui", control_value, variant_value, objective_metric?,
//         guardrails?, window_hours?, min_sample?, rationale? }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await liveEnabled())) return Response.json({ error: "Live experiments are disabled (live_experiments flag / OPTIMIZER_LIVE_TEST)." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || "").trim();
    if (!key) return Response.json({ error: "key required" }, { status: 400 });
    const type = body?.type === "flag" || body?.type === "ui" ? body.type : "setting";

    // Guardrail: never live-test compliance/money settings.
    if (type !== "ui") {
      if (COMPLIANCE_DENYLIST.has(key)) return Response.json({ error: `Refusing to live-test compliance/guardrail setting ${key}.` }, { status: 400 });
      const def = getDef(key);
      if (def?.sensitive) return Response.json({ error: `"${key}" is sensitive (money/legal). It must go through human approval, not a live auto-promote.` }, { status: 400 });
    }
    if (body?.control_value === undefined || body?.variant_value === undefined) {
      return Response.json({ error: "control_value and variant_value required" }, { status: 400 });
    }

    const exp = await createLiveExperiment({
      key, type, control_value: body.control_value, variant_value: body.variant_value,
      objective_metric: body.objective_metric, guardrails: body.guardrails,
      window_hours: body.window_hours, min_sample: body.min_sample, rationale: body.rationale,
      segment: body.segment ?? null, origin: "manual",
    });
    if (!exp) return Response.json({ error: "Could not create experiment" }, { status: 500 });
    return Response.json({ success: true, experiment: exp });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
