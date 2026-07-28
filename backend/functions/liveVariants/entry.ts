import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { resolveVariantOverrides } from "../../sdk/live-experiments.ts";

// liveVariants (authenticated) — the request-time applier. Returns THIS user's effective variant
// overrides across all running live experiments (settings/flags/ui) and records a one-time exposure.
// The client fetches this once per session (quiet-swap) and applies the ui variants; server-side flows
// read the same resolution for settings/flags. Opted-out users get an empty set (always control).
// Body: { session_id? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const overrides = await resolveVariantOverrides(user, body?.session_id);
    return Response.json({ ok: true, ...overrides });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
