import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireStepUp, enabledMethods, stepUpFreshnessSeconds, stepUpEnabled } from "../../sdk/step-up-auth.ts";

// stepUpChallenge — the client calls this before a sensitive action to learn whether a fresh re-auth is needed
// and which methods are acceptable (passkey / password / otp / vendor face). The client then performs one of
// them at the edge and calls stepUpVerify. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (!action) return Response.json({ error: "action is required." }, { status: 400 });

    const decision = await requireStepUp(String(user.id), action);
    return Response.json({
      ok: true, enabled: stepUpEnabled(), action,
      step_up_required: decision.required, acceptable_methods: decision.acceptable_methods,
      all_enabled_methods: enabledMethods(), freshness_seconds: stepUpFreshnessSeconds(),
      reason: decision.reason,
      note: decision.required
        ? "Complete one acceptable method (passkey preferred), then call stepUpVerify before the action."
        : "No fresh re-auth needed right now.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
