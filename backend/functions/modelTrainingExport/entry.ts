import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { modelTrainingEnabled, modelTrainingExportEnabled, buildTrainingExamples, toJsonl } from "../../sdk/model-training.ts";

// modelTrainingExport (admin) — exports the model-ready training dataset (first-party, PII-minimized) as JSONL
// or JSON, for use with an external training provider to build your custom model. GATED + COUNSEL-NOTED: the
// export of collected-data-derived examples for model training is behind MODEL_TRAINING_EXPORT_ENABLED (default
// OFF) because using collected data to train a model is a privacy/consent matter your privacy policy must
// disclose and counsel should clear — even though the examples here are operational (AI actions + human labels +
// measured outcomes), not user profiles. Readiness COUNTS are available without this gate (see modelReadiness).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!modelTrainingEnabled()) return Response.json({ ok: true, enabled: false, note: "Model-training data pipeline is OFF." });
    if (!modelTrainingExportEnabled()) {
      return Response.json({ ok: true, enabled: true, export_allowed: false, note: "Export is gated OFF (MODEL_TRAINING_EXPORT_ENABLED). Turn it on only after your privacy policy discloses model-training use and counsel clears it. Readiness counts are available via modelReadiness without this gate." });
    }
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    // extra guard: even internal export should be admin-initiated
    if (me && me.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(20000, Number(body.limit) || 5000));
    const format = String(body.format ?? "jsonl").toLowerCase();
    const examples = await buildTrainingExamples(limit);

    if (format === "json") return Response.json({ ok: true, enabled: true, export_allowed: true, count: examples.length, examples });
    return new Response(toJsonl(examples), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson", "Content-Disposition": `attachment; filename="training-export-${new Date().toISOString().slice(0, 10)}.jsonl"` },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
