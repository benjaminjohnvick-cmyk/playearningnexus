import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordEvents, telemetryEnabled } from "../../sdk/telemetry.ts";

// telemetryIngest (authenticated) — accepts a batch of lightweight interaction events from the client
// and stores a compact, scrubbed, bounded row. Default-on and ~free. Silently no-ops (200) when the
// site_telemetry flag is off, telemetry is disabled, or the user has a behavioral opt-out — so the
// client never needs special-casing.
// Body: { session_id, events: [{ type, path, target, value?, scroll_pct?, ts?, meta? }] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!(await telemetryEnabled(user, (user as any).country))) {
      return Response.json({ ok: true, recorded: 0, disabled: true });
    }
    const recorded = await recordEvents(user.id, String(body?.session_id || ""), body?.events || []);
    return Response.json({ ok: true, recorded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
