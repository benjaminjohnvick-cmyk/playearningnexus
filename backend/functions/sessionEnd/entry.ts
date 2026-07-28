import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { finalizeOnLogout } from "../../sdk/personalization.ts";

// sessionEnd (authenticated) — call this on LOGOUT (and best-effort on app background). It closes the
// user's session; the metrics recorded during it have already fed the per-segment aggregates, which the
// scheduled monitor evaluates. A change that reaches a statistically positive result is then applied at
// the user's NEXT login automatically.
// Body: { session_id?, summary? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    await finalizeOnLogout(user, body?.session_id, body?.summary);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
