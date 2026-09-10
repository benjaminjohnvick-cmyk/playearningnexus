import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { broadcastEnabled, broadcastConfigured, egressUrl, hlsUrlForRoom, hlsKeyPrefix, lowLatencyHls } from "../../sdk/broadcast.ts";
import { aiModerationEnabled } from "../../sdk/host-moderation.ts";

// sessionBroadcastStart — turns a hosted session into a QVC-scale BROADCAST: it starts a LiveKit Egress
// room-composite HLS egress and records the resulting CDN playlist URL on the GameSession. Once set, the token
// endpoint serves passive viewers that HLS stream over the CDN (no SFU load), so one feed scales to a huge
// audience. Host + interactive guests stay on WebRTC. Storage/CDN live in the Egress service's own config, so
// this request carries NO credentials. Gated by SESSION_HOSTING_ENABLED + HOSTING_BROADCAST_ENABLED; only the
// session's host or an admin may start/stop it. Safe no-op (configured:false) until LIVEKIT_EGRESS_URL +
// HLS_PLAYBACK_BASE_URL are set. See QVC-SCALE-BROADCAST.md.
//   Body: { room, stop?:bool, egress_id? }
async function livekitKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false });
    if (!broadcastEnabled()) return Response.json({ ok: true, enabled: true, broadcast_enabled: false, note: "HOSTING_BROADCAST_ENABLED is off." });
    // Public broadcast REQUIRES the moderation layer to be on (moderation + reporting must cover a public audience).
    if (!aiModerationEnabled()) return Response.json({ ok: false, enabled: true, moderation_required: true, error: "Public broadcast requires AI moderation (HOSTING_AI_MODERATION_ENABLED) to be enabled." }, { status: 409 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const room = String(b.room || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    const sess = (await base44.asServiceRole.entities.GameSession.filter({ session_id: room }).catch(() => []))[0];
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });
    const isHost = String(sess.host_player_id ?? "") === String(user.id) || String(sess.started_by ?? "") === (user.email ?? user.id);
    if (!isHost && user.role !== "admin") return Response.json({ error: "Only the host or an admin can control broadcast." }, { status: 403 });

    if (!broadcastConfigured()) {
      return Response.json({ ok: true, enabled: true, configured: false, note: "Broadcast not configured — set LIVEKIT_EGRESS_URL + HLS_PLAYBACK_BASE_URL (and deploy LiveKit Egress with storage → CDN)." });
    }

    const apiKey = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
    const apiSecret = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
    if (!apiKey || !apiSecret) return Response.json({ ok: true, enabled: true, configured: false, note: "LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set." });

    // Egress requests are authorized with a LiveKit token carrying the roomRecord grant.
    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { iss: apiKey, sub: `egress-${user.id}`, nbf: getNumericDate(0), exp: getNumericDate(60 * 60 * 6), video: { roomRecord: true } },
      await livekitKey(apiSecret),
    );
    const twirp = (svc: string) => `${egressUrl()}/twirp/livekit.Egress/${svc}`;
    const call = async (svc: string, payload: unknown) =>
      await fetch(twirp(svc), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

    // Stop a running broadcast.
    if (b.stop === true) {
      const egressId = String(b.egress_id || sess.egress_id || "");
      if (egressId) await call("StopEgress", { egress_id: egressId }).catch(() => null);
      if (sess.id) await base44.asServiceRole.entities.GameSession.update(sess.id, { hls_url: "", broadcast_mode: "", egress_id: "" }).catch(() => null);
      return Response.json({ ok: true, enabled: true, configured: true, stopped: true, room });
    }

    // Already broadcasting → return the existing stream.
    if (sess.hls_url) return Response.json({ ok: true, enabled: true, configured: true, already: true, mode: "hls", hls_url: String(sess.hls_url), room });

    // Start a room-composite HLS (segmented) egress. Storage is configured on the Egress side → the segments
    // land in your bucket and are served by your CDN at HLS_PLAYBACK_BASE_URL/<room>/index.m3u8.
    const ll = lowLatencyHls();
    const prefix = hlsKeyPrefix(room);
    const startBody = {
      room_name: room,
      layout: "single-speaker",
      segment_outputs: [{
        filename_prefix: `${prefix}segment`,
        playlist_name: `${prefix}index.m3u8`,
        live_playlist_name: ll ? `${prefix}live.m3u8` : "",
        segment_duration: ll ? 2 : 6,
      }],
    };
    const r = await call("StartRoomCompositeEgress", startBody).then((x) => x.json()).catch(() => null) as Record<string, unknown> | null;
    const egressId = r && (r.egress_id || r.egressId);
    if (!egressId) {
      return Response.json({ ok: false, enabled: true, configured: true, error: "Egress did not start (verify LiveKit Egress is running + reachable at LIVEKIT_EGRESS_URL).", detail: r ?? null }, { status: 502 });
    }

    const hlsUrl = hlsUrlForRoom(room);
    if (sess.id) {
      await base44.asServiceRole.entities.GameSession.update(sess.id, { hls_url: hlsUrl, broadcast_mode: ll ? "ll_hls" : "hls", egress_id: String(egressId) }).catch(() => null);
    }
    return Response.json({ ok: true, enabled: true, configured: true, started: true, mode: "hls", hls_url: hlsUrl, egress_id: String(egressId), room, note: "Broadcast started — passive viewers now stream via the CDN (unbounded), host stays on WebRTC." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
