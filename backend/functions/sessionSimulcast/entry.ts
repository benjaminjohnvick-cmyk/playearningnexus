import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString, snapNumber } from "../../sdk/settings.ts";
import { buildSimulcastPlan, type SimulcastTargetInput } from "../../sdk/rtmp-simulcast.ts";

// sessionSimulcast — start/stop/status of pushing a hosted livestream to multiple RTMP destinations at once. It
// builds the fan-out PLAN (validated, secret-free) and dispatches it to the media RELAY (SIMULCAST_RELAY_URL),
// which does the actual WebRTC-in → RTMP-out fan-out and pulls each stream key from the secret manager by ref.
// This function never touches a raw stream key. Only the session HOST can start/stop it. Gated behind
// HOSTING_SOCIAL_SIMULCAST_ENABLED.
//
//   action:"start"  body:{ session_id, targets:[{platform, ingest_url, stream_key_secret_ref}] }
//   action:"stop"   body:{ session_id }
//   action:"status" body:{ session_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const sessionId = String(body?.session_id || "");
    if (!sessionId) return Response.json({ error: "session_id required" }, { status: 400 });

    const sess = (await db.filter("GameSession", { session_id: sessionId }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });

    if (action === "status") {
      const job = (await db.filter("SimulcastJob", { session_id: sessionId }, "-created_date", 1).catch(() => []))[0] ?? null;
      return Response.json({ ok: true, job });
    }

    if (!snapBool("HOSTING_SOCIAL_SIMULCAST_ENABLED", false)) {
      return Response.json({ error: "Social simulcast is disabled (HOSTING_SOCIAL_SIMULCAST_ENABLED off)." }, { status: 409 });
    }
    const isHost = String(sess.host_player_id || "") === String(user.id) || String(sess.started_by || "") === (user.email ?? String(user.id));
    if (!isHost) return Response.json({ error: "only the session host can control simulcast" }, { status: 403 });

    const relay = snapString("SIMULCAST_RELAY_URL", "");
    if (!relay) return Response.json({ error: "No media relay configured (SIMULCAST_RELAY_URL). Deploy a relay (MediaMTX/LiveKit/ffmpeg worker) and set its URL." }, { status: 503 });

    if (action === "stop") {
      await dispatchRelay(relay, { action: "stop", session_id: sessionId });
      await db.create("SimulcastJob", { session_id: sessionId, action: "stop", by: user.id, at: new Date().toISOString() }).catch(() => null);
      return Response.json({ ok: true, stopped: true });
    }

    if (action === "start") {
      const plan = buildSimulcastPlan(body?.targets as SimulcastTargetInput[], snapNumber("SIMULCAST_MAX_TARGETS", 5));
      if (plan.count === 0) return Response.json({ ok: false, error: "no valid RTMP targets", dropped: plan.dropped }, { status: 400 });

      // Dispatch to the relay. We send target references (ingest URL + secret REF) — never a raw key. The relay
      // resolves each secret ref and does the WebRTC→RTMP fan-out; the host's media reaches the relay via WebRTC
      // (client side). Requires the host to have accepted the content policy at session start.
      const dispatch = await dispatchRelay(relay, {
        action: "start", session_id: sessionId, room_id: sess.room_id ?? null,
        ingest_hint: body?.ingest_hint ?? null, targets: plan.targets,
      });

      const job = await db.create("SimulcastJob", {
        session_id: sessionId, action: "start", by: user.id,
        targets: plan.targets.map((t) => ({ platform: t.platform, ingest_url: t.ingest_url })),  // NO secret ref stored on the job log
        dropped: plan.dropped, relay_ok: dispatch.ok, relay_status: dispatch.status,
        at: new Date().toISOString(),
      }).catch(() => null);

      return Response.json({
        ok: dispatch.ok, count: plan.count, dropped: plan.dropped,
        job_id: job ? String((job as Record<string, unknown>).id ?? "") : null,
        note: dispatch.ok
          ? `Simulcasting to ${plan.count} destination(s) via the relay. Stream keys stayed in the secret manager. #ad disclosure applies where the stream is a paid promotion.`
          : `Relay dispatch failed (${dispatch.status}). Nothing is streaming.`,
      });
    }

    return Response.json({ error: `unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

async function dispatchRelay(relay: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(relay.replace(/\/$/, "") + "/simulcast", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, status: 0 }; }
}
