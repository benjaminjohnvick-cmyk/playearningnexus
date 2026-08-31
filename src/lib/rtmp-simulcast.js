// rtmp-simulcast.js — client helper to push a hosted livestream to multiple RTMP platforms via the server-side
// relay. Browsers can't emit RTMP, so the host's MediaStream (screen share or game canvas) is sent to the RELAY
// over WebRTC, and the relay fans it out to YouTube/Facebook/Twitch/etc. This module coordinates start/stop and
// hands the media to a `relayTransport` you plug in (a WebRTC connection to your media server — MediaMTX / LiveKit
// / an ingest gateway). It never handles stream keys; those live in the secret manager and the relay uses them.
//
// Targets are passed as { platform, ingest_url, stream_key_secret_ref } — a secret REFERENCE, never the key.

export function createSimulcast(base44, relayTransport = null) {
  const state = { sessionId: null, streaming: false };

  /** Start simulcasting the given MediaStream to the targets. `targets` carry secret refs, not raw keys. */
  async function start(sessionId, stream, targets, { ingestHint } = {}) {
    state.sessionId = sessionId;
    // 1) Tell the server to program the relay (validates targets, dispatches the fan-out plan).
    const res = await base44.functions.invoke("sessionSimulcast", { action: "start", session_id: sessionId, targets, ingest_hint: ingestHint || null })
      .catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (!res || res.ok === false) return res || { ok: false };
    // 2) Send the host's media to the relay ingest over WebRTC (your transport owns the actual connection).
    try { await relayTransport?.publish?.(stream, { sessionId, ingestHint }); } catch (e) { return { ok: false, error: "relay publish failed: " + String(e?.message || e) }; }
    state.streaming = true;
    return res;
  }

  async function stop() {
    if (!state.sessionId) return { ok: true };
    try { await relayTransport?.unpublish?.(); } catch { /* ignore */ }
    const res = await base44.functions.invoke("sessionSimulcast", { action: "stop", session_id: state.sessionId }).catch(() => ({ ok: false }));
    state.streaming = false;
    return res;
  }

  async function status() {
    if (!state.sessionId) return { ok: false };
    return base44.functions.invoke("sessionSimulcast", { action: "status", session_id: state.sessionId }).catch(() => ({ ok: false }));
  }

  return { start, stop, status, get streaming() { return state.streaming; } };
}
