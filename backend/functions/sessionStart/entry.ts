import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { applyOnLogin } from "../../sdk/personalization.ts";

// sessionStart (authenticated) — call this on LOGIN and on native app-resume. It resolves the user's
// effective variant overrides for their segment (running experiments + segment-kept promoted changes),
// snapshots the kept-change state, and returns the overrides for the client to apply. This is the
// "apply at next login, quietly" moment: any change that became a winner while they were away is now
// part of what this returns, with no mid-session shift.
// Body: { session_id? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const applied = await applyOnLogin(user, body?.session_id);
    return Response.json({ ok: true, ...applied });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
