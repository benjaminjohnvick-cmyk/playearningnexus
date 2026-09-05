import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { verifyJwt } from "../../sdk/auth.ts";
import { pmfAgentEnabled, runPmfRevenuePass } from "../../sdk/pmf-agent.ts";

// pmfRevenueAgentRun — the AI PMF & revenue agent's scheduled pass. Collects the feature/site signals, ranks the
// portfolio for product-market fit (retention-weighted) and revenue, records learning, and writes an advisory
// plan (human-gated execution — no money/price/legal changed automatically). Authorized for an admin (run now)
// or the scheduler's signed token. Runs continuously so PMF + revenue discovery keeps improving after launch.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    let authorized = user?.role === "admin";
    if (!authorized && body?.scheduled === true) {
      const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const payload = bearer ? await verifyJwt(bearer).catch(() => null) : null;
      if (payload) authorized = true;
    }
    if (!authorized) return Response.json({ error: "Forbidden (admin or scheduler only)." }, { status: 403 });

    if (!pmfAgentEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "PMF & revenue agent is OFF (PMF_AGENT_ENABLED)." });
    }

    const plan = await runPmfRevenuePass();
    return Response.json({
      ok: true, enabled: true, computed_at: plan.computed_at, window_days: plan.window_days,
      summary: plan.summary,
      promote: plan.plan.filter((p) => p.action === "promote").map((p) => ({ key: p.key, name: p.name, pmf_score: p.pmf_score, revenue_usd: p.revenue_usd })),
      needs_approval: plan.plan.filter((p) => p.sensitive).map((p) => ({ key: p.key, name: p.name, action: p.action, pricing_hint: p.pricing_hint, rationale: p.rationale })),
      note: "Advisory plan written + signals/learning recorded. Pricing/tier/money moves are surfaced for your approval — nothing sensitive is auto-applied (constraints preserved).",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
