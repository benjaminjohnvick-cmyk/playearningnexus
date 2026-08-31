import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { effectiveSettings } from "../../sdk/settings.ts";
import { scaleLeversFromSettings, decideScale, autoScaleEnabled, type ScaleMetrics } from "../../sdk/scale-governor.ts";

// scaleAdvisor — the SAFE "AI scaling agent". Given live load metrics it reports (a) the CONFIG changes the
// auto-scale governor would apply automatically (render → serverless GPU, cache, replica, concurrency, AI tier),
// and (b) INFRASTRUCTURE recommendations that a human (or the cloud auto-scaler) should act on — add app
// instances, raise GPU concurrency, enable the DB replica, etc. It is READ-ONLY and ADVISORY: it never edits
// code and never provisions infrastructure. That is by design — scaling is done by running the SAME stateless
// code on more machines via an auto-scaler (AWS Fargate/App Runner, Railway replicas, K8s HPA), not by an AI
// rewriting production code. Wire this to a monitor to get scale recommendations; the governor handles the
// config half automatically when AUTO_SCALE_ENABLED is on. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const m = (body.metrics || {}) as Partial<ScaleMetrics>;
    const metrics: ScaleMetrics = {
      active_users: Math.max(0, Number(m.active_users) || 0),
      requests_per_min: Math.max(0, Number(m.requests_per_min) || 0),
      queue_depth: Math.max(0, Number(m.queue_depth) || 0),
      render_per_day: Math.max(0, Number(m.render_per_day) || 0),
      db_read_qps: Math.max(0, Number(m.db_read_qps) || 0),
    };

    const levers = scaleLeversFromSettings();
    const all = await effectiveSettings().catch(() => []) as Array<{ key: string; value: string }>;
    const current: Record<string, string> = {};
    for (const l of levers) current[l.key] = String(all.find((s) => s.key === l.key)?.value ?? l.base);
    const decision = decideScale(levers, metrics, current);

    // Infra recommendations (for the human / cloud auto-scaler — NOT auto-applied).
    const infra: string[] = [];
    if (metrics.requests_per_min >= 600) infra.push("App tier under load: ensure the cloud auto-scaler (AWS Fargate/App Runner target-tracking, Railway replicas, or K8s HPA) is ON with CPU/RPS targets — it runs the same stateless code on more instances.");
    if (metrics.db_read_qps >= 200) infra.push("DB read load high: confirm DATABASE_REPLICA_URL is set so reads route to the replica; consider a larger replica.");
    if (metrics.render_per_day >= 50) infra.push("Video render volume high: serverless GPU endpoint should be scaling up automatically; raise its max concurrency and confirm the daily $ cap.");
    if (metrics.queue_depth >= 500) infra.push("Background backlog: raise worker concurrency / add a worker instance.");
    if (!infra.length) infra.push("Load is within the current tier — no infra action needed.");

    // Optional Claude reasoning layer — the "based on Claude" scaling agent that runs inside the platform. It
    // DIAGNOSES the situation and explains the plan in plain language on top of the deterministic recommendations
    // (the actual config flips stay rule-based/deterministic for reliability; the LLM never decides them alone).
    let diagnosis = "";
    if (body.explain !== false) {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are the platform's scaling agent. Given these live metrics and the deterministic recommendations, write a 2-3 sentence plain-English assessment: is the site under scale pressure, what will auto-adjust, and what (if anything) the operator should do on the infra side. Do NOT propose code changes.
METRICS: ${JSON.stringify(metrics)}
CONFIG CHANGES THE GOVERNOR WOULD APPLY: ${JSON.stringify(decision.changes)}
INFRA RECOMMENDATIONS: ${JSON.stringify(infra)}`,
      }).catch(() => null) as Record<string, unknown> | null;
      diagnosis = String(r?.content ?? r ?? "").toString().slice(0, 1200);
    }

    return Response.json({
      ok: true, auto_scale_enabled: autoScaleEnabled(), metrics,
      config_governor: { would_apply: decision.changes, at_scale: decision.at_scale, note: autoScaleEnabled() ? "The governor applies these automatically." : "Governor OFF — these would apply if AUTO_SCALE_ENABLED were on." },
      infra_recommendations: infra,
      diagnosis,
      note: "Advisory only. Scaling runs the same stateless code on more machines via your cloud auto-scaler; this Claude-based agent recommends + explains and (via the governor) adjusts config — it never rewrites code or provisions servers itself.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
