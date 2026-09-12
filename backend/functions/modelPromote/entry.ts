import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setSetting } from "../../sdk/settings.ts";
import { runShadowEval } from "../../sdk/model-eval.ts";

// modelPromote (admin) — manually switch the active model backend. Promoting to "custom" is guarded: it only
// succeeds when the model is actually READY (matches the incumbent at target accuracy over enough samples),
// unless force=true. Rolling back to "claude_shadow" is always allowed (a safe revert). Body:
//   { backend: "custom" | "claude_shadow", force?: true }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me || me.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const backend = String(body.backend ?? "").trim();
    if (backend !== "custom" && backend !== "claude_shadow") return Response.json({ error: 'backend must be "custom" or "claude_shadow".' }, { status: 400 });

    if (backend === "custom" && body.force !== true) {
      const r = await runShadowEval();
      if (!r.ready) return Response.json({ error: `Not ready — accuracy ${r.accuracy_pct}% vs incumbent on ${r.test_samples}/${r.min_samples} samples (target ${r.target_pct}%). Pass force:true to override.`, ready: false, eval: r }, { status: 409 });
    }

    const res = await setSetting("MODEL_BACKEND", backend, String(me.email ?? me.id));
    return Response.json({ ok: true, backend, changed_from: res.from, changed_to: res.to, by: me.email });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
