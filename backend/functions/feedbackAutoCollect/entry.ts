import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { autoCollectEnabled, domainForSurface, recordFeedback } from "../../sdk/feedback.ts";

// feedbackAutoCollect — the AUTOMATIC collector. It mines the behavioral telemetry the site already captures
// on every page (InteractionEvent: dwell time, scroll, friction points, purchases) and turns it into implicit
// feedback signals attributed to the right autonomy DOMAIN — so the AI learns from what customers DO, with no
// one ever asked a question. Runs on a schedule (and can be triggered manually). Idempotent via a cursor.
// Admin / seed-admin service only.
const CURSOR_ID = "feedback_autocollect";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!autoCollectEnabled()) return Response.json({ ok: true, skipped: "auto-collect disabled" });

    const now = new Date().toISOString();
    // Cursor: only process telemetry newer than last run (string-comparable ISO timestamps).
    const stateRows = await db.filter("AutoCollectState", { key: CURSOR_ID }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
    const cursor = String(stateRows?.[0]?.cursor_at ?? "");

    const batches = await db.filter("InteractionEvent", {}, "-at", 4000).catch(() => []) as Record<string, unknown>[];

    // Aggregate per surface (page/feature) across all fresh events.
    type Agg = { dwellSum: number; dwellN: number; friction: number; purchases: number; events: number };
    const perSurface: Record<string, Agg> = {};
    let newest = cursor;
    let processed = 0;

    const bump = (surface: string): Agg => (perSurface[surface] ??= { dwellSum: 0, dwellN: 0, friction: 0, purchases: 0, events: 0 });

    for (const row of batches) {
      const at = String(row.at ?? row.created_at ?? "");
      if (cursor && at <= cursor) continue;                 // already processed
      if (at > newest) newest = at;

      // Shape A — a telemetry batch with an events[] array (from uxTracker → telemetryIngest).
      const events = Array.isArray(row.events) ? row.events as Record<string, unknown>[] : null;
      if (events) {
        for (const e of events) {
          const surface = String(e.page ?? e.feature_area ?? "");
          if (!surface) continue;
          const a = bump(surface); a.events++; processed++;
          const t = Number(e.time_on_page_seconds); if (Number.isFinite(t) && t > 0) { a.dwellSum += t; a.dwellN++; }
          if (e.is_friction_point === true) a.friction++;
          if (String(e.event_type ?? "").toLowerCase().includes("purchase")) a.purchases++;
        }
        continue;
      }
      // Shape B — a single funnel event (e.g. purchase-signal writes {event_type, value}).
      const et = String(row.event_type ?? "");
      if (et) {
        const surface = String(row.page ?? row.surface ?? et);
        const a = bump(surface); a.events++; processed++;
        if (et.toLowerCase().includes("purchase")) a.purchases++;
      }
    }

    // Emit a small, bounded set of implicit feedback signals — one per (surface, signal) — to the shared
    // learning substrate, attributed to the mapped domain. Skip surfaces that don't map to an auto_ok domain.
    let emitted = 0;
    const surfaces = Object.entries(perSurface).sort((a, b) => b[1].events - a[1].events).slice(0, 60);
    for (const [surface, a] of surfaces) {
      const domain = domainForSurface(surface);
      if (!domain) continue;
      if (a.dwellN) {
        await recordFeedback(db, { surface, domain, kind: "dwell", value: a.dwellSum / a.dwellN, meta: { auto: true, samples: a.dwellN } }, now); emitted++;
      }
      if (a.purchases > 0) {
        await recordFeedback(db, { surface, domain, kind: "conversion", value: 1, meta: { auto: true, purchases: a.purchases } }, now); emitted++;
      }
      if (a.friction > 0) {
        await recordFeedback(db, { surface, domain, kind: "report", meta: { auto: true, friction: a.friction } }, now); emitted++;
      }
    }

    // Advance the cursor so the next run doesn't re-process these events.
    if (newest && newest !== cursor) {
      await db.create("AutoCollectState", { key: CURSOR_ID, cursor_at: newest, ran_at: now, created_at: now }).catch(() => null);
    }

    return Response.json({ ok: true, telemetry_batches: batches.length, events_processed: processed, surfaces: surfaces.length, signals_emitted: emitted, cursor_advanced_to: newest || null });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
