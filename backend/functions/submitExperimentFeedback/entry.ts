import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// submitExperimentFeedback (authenticated user) — a customer answers an A/B change-gating experiment.
// Their response is appended to the experiment; evaluateExperiments later decides whether the change
// ships. Body: { experiment_id, prefers_variant?, satisfaction?, answers? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { experiment_id } = body;
    if (!experiment_id) return Response.json({ error: "experiment_id required" }, { status: 400 });

    const exp = await db.get("OptimizationExperiment", String(experiment_id));
    if (!exp) return Response.json({ error: "Experiment not found" }, { status: 404 });
    if (exp.status !== "testing") return Response.json({ error: `Experiment is ${exp.status}` }, { status: 409 });

    const responses = Array.isArray(exp.responses) ? exp.responses : [];
    // One response per user.
    if (responses.some((r: any) => r.user_id === user.id)) {
      return Response.json({ success: true, deduped: true });
    }
    // Atomic append (no read-modify-write race that could drop a concurrent voter's response).
    const updated = await db.appendToArray("OptimizationExperiment", String(experiment_id), "responses", {
      user_id: user.id,
      prefers_variant: body.prefers_variant === true || body.answer === true,
      satisfaction: Number(body.satisfaction) || null,
      answers: body.answers ?? null,
      at: new Date().toISOString(),
    });
    const count = Array.isArray((updated as any)?.responses) ? (updated as any).responses.length : responses.length + 1;
    await db.update("OptimizationExperiment", String(experiment_id), { response_count: count }).catch(() => null);
    return Response.json({ success: true, responses: count });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
