import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
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

    // Count distinct reporters (one report per viewer per session).
    const reporters: string[] = Array.isArray(sess.reporters) ? sess.reporters.map(String) : [];
    const already = reporters.includes(String(user.id));
    if (!already) reporters.push(String(user.id));
    const reports = reporters.length;

    const threshold = reportThreshold();
    const suspend = reports >= threshold && String(sess.status) !== "ended";

    if (sess.id) {
      await base44.asServiceRole.entities.GameSession.update(sess.id, {
        reporters, report_count: reports,
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
