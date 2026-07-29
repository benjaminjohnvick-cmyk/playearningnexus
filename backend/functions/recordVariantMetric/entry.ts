import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordMetricForUser } from "../../sdk/live-experiments.ts";

// recordVariantMetric (authenticated) — report an outcome or guardrail metric for the current user,
// attributed to their assigned variant in every running live experiment. This is how the live A/B
// learns what users actually DO. Common metrics: "purchase", "click_through", "add_to_cart",
// "refund", "complaint", "drop_off".
// Body: { metric }
//
// SERVER-AUTHORITATIVE VALUE: this endpoint records an OCCURRENCE (value = 1) only. The recorded
// magnitude is NEVER taken from the client — otherwise a user could POST { metric: "purchase",
// value: 999999 } to skew the bandit toward their assigned variant and force a bad change to be
// promoted. Rate-based measurement (objective_count / exposures) only needs an occurrence count, so
// value=1 is exactly right. Magnitude/revenue-weighted signals must be recorded from an authoritative
// SERVER event (order fulfillment, spendBalance, a payout rail) — not from this client boundary.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const metric = String(body?.metric || "").trim();
    if (!metric) return Response.json({ error: "metric required" }, { status: 400 });
    // Force an occurrence count; ignore any client-supplied value (see header note).
    const recorded = await recordMetricForUser(user.id, metric, 1);
    return Response.json({ ok: true, recorded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
