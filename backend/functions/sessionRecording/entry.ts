import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool } from "../../sdk/settings.ts";

// sessionRecording — register and list recordings/clips of a hosted session (Tier-3 capability). The bytes live
// in object storage (the client uploads there and passes the URL); this only stores METADATA + moderation state,
// so the DB never holds media. A recording is created as `pending_moderation` and only listed as replayable once
// approved — because a recording of a screen share can capture anything, it must clear moderation before others
// can watch it. Gated behind HOSTING_RECORDING_ENABLED (clips also require HOSTING_CLIPS_ENABLED). Consent from
// the host is required (participants were told at join that the session may be recorded).
//
//   action: "register"  body: { session_id, url, kind:"recording"|"clip", duration_s, consented:true }
//   action: "list"      body: { session_id }  → approved recordings for replay / on-demand
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "register");

    if (action === "list") {
      const sessionId = String(body?.session_id || "");
      if (!sessionId) return Response.json({ error: "session_id required" }, { status: 400 });
      const rows = await db.filter("SessionRecording", { session_id: sessionId, moderation_status: "approved" }, "-created_date", 100).catch(() => []);
      return Response.json({ ok: true, recordings: rows });
    }

    // register
    if (!snapBool("HOSTING_RECORDING_ENABLED", false)) {
      return Response.json({ error: "Recording is disabled (HOSTING_RECORDING_ENABLED off)." }, { status: 409 });
    }
    const kind = body?.kind === "clip" ? "clip" : "recording";
    if (kind === "clip" && !snapBool("HOSTING_CLIPS_ENABLED", false)) {
      return Response.json({ error: "Clips are disabled (HOSTING_CLIPS_ENABLED off)." }, { status: 409 });
    }
    const sessionId = String(body?.session_id || "");
    const url = String(body?.url || "");
    if (!sessionId || !url) return Response.json({ error: "session_id and url (object-storage location) required" }, { status: 400 });
    if (body?.consented !== true) return Response.json({ error: "consent required to store a recording" }, { status: 428 });

    // Verify the session exists and this user was the host or a participant.
    const sess = (await db.filter("GameSession", { session_id: sessionId }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });
    const isHost = String(sess.host_player_id || "") === String(user.id) || String(sess.started_by || "") === (user.email ?? String(user.id));
    const isPlayer = Array.isArray(sess.player_ids) && sess.player_ids.map(String).includes(String(user.id));
    if (!isHost && !isPlayer) return Response.json({ error: "not a participant of this session" }, { status: 403 });

    const rec = await db.create("SessionRecording", {
      session_id: sessionId, room_id: sess.room_id ?? null, content_type: sess.content_type ?? "game",
      kind, url, duration_s: Math.max(0, Number(body?.duration_s) || 0),
      created_by_user: user.id, consented: true,
      moderation_status: "pending_moderation",   // must be approved before it's listed for replay
      at: new Date().toISOString(),
    }, user.email ?? String(user.id)).catch(() => null);

    return Response.json({
      ok: true, recording_id: rec ? String((rec as Record<string, unknown>).id ?? "") : null,
      moderation_status: "pending_moderation",
      note: "Stored (metadata only; media stays in object storage). It becomes replayable after moderation approval.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
