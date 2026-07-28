import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordMetricForUser } from "../../sdk/live-experiments.ts";

// recordVariantMetric (authenticated) — report an outcome or guardrail metric for the current user,
// attributed to their assigned variant in every running live experiment. This is how the live A/B
// learns what users actually DO. Common metrics: "purchase", "click_through", "add_to_cart",
// "refund", "complaint", "drop_off". Values default to 1 (a count).
// Body: { metric, value? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const metric = String(body?.metric || "").trim();
    if (!metric) return Response.json({ error: "metric required" }, { status: 400 });
    const recorded = await recordMetricForUser(user.id, metric, Number(body?.value) || 1);
    return Response.json({ ok: true, recorded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
