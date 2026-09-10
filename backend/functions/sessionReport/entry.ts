import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";
import { reportThreshold, recordModEvent } from "../../sdk/host-moderation.ts";

// sessionReport — a viewer reports a live session. Distinct reporters are counted; at HOSTING_MODERATION_REPORT_
// THRESHOLD the session is auto-suspended pending review (a human-signal kill-switch alongside AI moderation).
// Part of the moderation layer; does not replace the DMCA notice path (dmcaTakedownRequest) for copyright.
//   POST { room, reason? } → { ok, reports, suspended }
export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const room = String(b.room || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    const reason = String(b.reason || "").slice(0, 300);
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    const sess = (await base44.asServiceRole.entities.GameSession.filter({ session_id: room }).catch(() => []))[0];
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });

    // Count distinct reporters (one report per viewer per session). Atomic set-append so a burst of DIFFERENT
    // reporters can't lose each other to a read-then-write race (which would stall the auto-suspend threshold).
    let reporters: string[] = Array.isArray(sess.reporters) ? sess.reporters.map(String) : [];
    if (sess.id) {
      const updated = await db.appendToSetArray("GameSession", String(sess.id), "reporters", String(user.id)).catch(() => null);
      if (updated && Array.isArray((updated as Record<string, unknown>).reporters)) {
        reporters = ((updated as Record<string, unknown>).reporters as unknown[]).map(String);
      } else if (!reporters.includes(String(user.id))) {
        reporters.push(String(user.id));
      }
    }
    const reports = reporters.length;

    const threshold = reportThreshold();
    const suspend = reports >= threshold && String(sess.status) !== "ended";

    if (sess.id) {
      // Persist the distinct count, and suspend once the threshold is crossed (idempotent under a race).
      await db.update("GameSession", String(sess.id), {
        report_count: reports,
        ...(suspend ? { status: "ended", moderation_status: "suspended_reports", hls_url: "" } : {}),
      }).catch(() => null);
    }
    await recordModEvent({
      session_id: room, host_player_id: String(sess.host_player_id ?? ""), type: "report",
      reason: reason || "viewer report", actor: user.email ?? String(user.id),
    });

    return Response.json({ ok: true, room, reports, suspended: suspend, note: suspend ? "Session suspended pending review — thank you." : "Report received." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
