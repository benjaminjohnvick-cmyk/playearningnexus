import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { recordEvents, telemetryEnabled, mapJourneyToEvents } from "../../sdk/telemetry.ts";

// telemetryIngest (authenticated) — ONE coalesced write for the client. It (1) always persists the raw
// journey rows (UserJourneyEvent — the existing journey log, independent of the telemetry flag), and
// (2) stores the compact statistical aggregate (InteractionEvent) when telemetry is enabled + sampled.
// This lets the client make a single request per flush instead of two. Silently no-ops the aggregate
// (still 200) when the site_telemetry flag is off, telemetry is disabled, or the user opted out.
// Body: { session_id, journey?: [rawJourneyEvent...], events?: [telemetryEvent...] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const journey = Array.isArray(body?.journey) ? body.journey.slice(0, 200) : [];

    // (1) Journey log — always best-effort (this is the pre-existing UserJourneyEvent stream).
    if (journey.length) {
      const rows = journey.map((e: any) => ({ ...e, user_id: user.id, session_id: String(body?.session_id || e?.session_id || "") }));
      await base44.entities.UserJourneyEvent.bulkCreate(rows).catch(() => {});
    }

    // (2) Statistical aggregate — gated by flag/opt-out/sample.
    let recorded = 0;
    if (await telemetryEnabled(user, (user as any).country)) {
      const events = Array.isArray(body?.events) && body.events.length ? body.events : mapJourneyToEvents(journey);
      recorded = await recordEvents(user.id, String(body?.session_id || ""), events);
    }
    return Response.json({ ok: true, recorded, journey: journey.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
