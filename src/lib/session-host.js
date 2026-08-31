// session-host.js — Tier-3 client: automatic PLAYER hosting for live game sessions, the multiplayer
// "listen-server" model. A player's device hosts the live session (the round, positions, transient score); the
// server only decides who hosts and validates the reward at the end. If the host drops, the session migrates to
// another player or ends — and because the hosted state is disposable, nobody loses anything of value.
//
// HARD RULE: nothing of value lives in the session. Rewards are finalized ONLY by the server
// (sessionRewardValidate), which recomputes them from the reported score and caps them. A cheating host can at
// worst ruin a round; it can never mint Site Cash.
//
// Transport note: the actual real-time data channel between players (WebRTC data channel, or a websocket relay)
// is environment-specific. This module owns the COORDINATION — role assignment, heartbeat, host migration, and
// the server reward handshake — and exposes clean hooks (`transport`) you plug your channel into. The
// coordination logic below is what makes the hosting automatic and safe; the byte-moving is a thin adapter.

const HEARTBEAT_MS = 4000;
const HOST_TIMEOUT_MS = 12000; // no heartbeat from host for this long → migrate

function now() { return Date.now(); }

/** Create a session-host controller.
 *  @param base44   the app client (for server functions).
 *  @param transport optional adapter: { send(msg), onMessage(cb), connectTo(hostId), stop() }. If omitted, the
 *                   controller still coordinates via the server (host assignment + reward) and no-ops the P2P
 *                   channel, so it degrades to server-hosted safely. */
export function createSessionHost(base44, transport = null) {
  const state = {
    roomId: null, selfId: null, sessionId: null,
    role: "idle",            // "idle" | "host" | "peer" | "server"
    hostId: null,
    lastHostBeat: 0,
    heartbeatTimer: null, watchdogTimer: null,
    gameState: null,         // disposable session state (host holds the authoritative-for-the-ROUND copy)
    listeners: new Set(),
  };

  const emit = (ev) => state.listeners.forEach((f) => { try { f(ev, state); } catch { /* ignore */ } });
  const onEvent = (fn) => { state.listeners.add(fn); return () => state.listeners.delete(fn); };

  /** Join/host a room. Asks the server who should host, then takes the host or peer role.
   *  opts: { hostScore, contentType: "game"|"stream"|"screen", title, timed, contentPolicyAck }.
   *  A non-game host (stream/screen) must pass contentPolicyAck:true; the server also requires the feature gate.
   *  Returns the server response — includes { unlock_required, hosting } when hosting is earnings-gated and the
   *  user hasn't earned the daily minimum yet, so the UI can show "earn $X more to host." */
  async function join(roomId, selfId, players, { hostScore, contentType = "game", title = "", timed = false, contentPolicyAck = false, capabilities = [] } = {}) {
    state.roomId = roomId; state.selfId = String(selfId);
    state.contentType = contentType; state.timed = !!timed;
    const res = await base44.functions.invoke("sessionHostAssign", {
      room_id: roomId, self_player_id: state.selfId,
      content_type: contentType, title, timed: !!timed, content_policy_ack: !!contentPolicyAck,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      players: (players || []).map((p) => ({ id: String(p.id), hostScore: Number(p.hostScore ?? (p.id === selfId ? hostScore : 0)) || 0 })),
    }).catch(() => null);

    if (!res || res.ok === false) { emit("role"); return res || { ok: false, reason: "assign failed" }; }
    state.sessionId = res.session_id;
    state.capabilities = Array.isArray(res.capabilities) ? res.capabilities : [];
    state.startedAt = now();
    if (res.host_type === "server") { state.role = "server"; state.hostId = null; }
    else if (res.you_are_host || res.host_player_id === state.selfId) { becomeHost(); }
    else { becomePeer(res.host_player_id); }
    if (state.timed) startTimer();
    emit("role");
    return { ...res, role: state.role };
  }

  // ── Side timer (time-based competition) ───────────────────────────────────────────────────────────────────
  /** Seconds since this session started (for the side timer / time-based ranking). */
  function getElapsedSeconds() { return state.startedAt ? Math.max(0, Math.floor((now() - state.startedAt) / 1000)) : 0; }
  /** Start ticking the side timer; `onTick(seconds)` fires every `ms`. */
  function startTimer(onTick, ms = 1000) {
    state.startedAt = state.startedAt || now();
    clearInterval(state.timerTimer);
    state.timerTimer = setInterval(() => { emit("timer"); if (typeof onTick === "function") { try { onTick(getElapsedSeconds()); } catch { /* ignore */ } } }, ms);
  }
  function stopTimer() { clearInterval(state.timerTimer); }

  // ── Screen mirroring / streaming ──────────────────────────────────────────────────────────────────────────
  /** Start sharing the host's screen (screen mirroring). Uses the browser's picker (getDisplayMedia) so the user
   *  explicitly chooses what to share. Returns the MediaStream to hand to your transport (WebRTC). Content is
   *  subject to the platform content policy + moderation — the host accepted that at join (contentPolicyAck). */
  async function startScreenShare({ audio = true } = {}) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      return { ok: false, reason: "screen sharing not supported on this device/browser" };
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio });
      state.screenStream = stream;
      // If the user stops sharing from the browser UI, clean up.
      stream.getVideoTracks().forEach((t) => { t.addEventListener("ended", () => stopScreenShare()); });
      try { transport?.addStream?.(stream); } catch { /* transport optional */ }
      emit("screen_on");
      return { ok: true, stream };
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) };
    }
  }
  function stopScreenShare() {
    try { state.screenStream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
    state.screenStream = null;
    emit("screen_off");
  }

  function becomeHost() {
    state.role = "host"; state.hostId = state.selfId; state.gameState = state.gameState || {};
    // Host broadcasts heartbeats + state so peers know it's alive and can take over if it dies.
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(() => {
      transport?.send?.({ type: "host_beat", sessionId: state.sessionId, hostId: state.selfId, t: now() });
    }, HEARTBEAT_MS);
  }

  function becomePeer(hostId) {
    state.role = "peer"; state.hostId = String(hostId); state.lastHostBeat = now();
    try { transport?.connectTo?.(state.hostId); } catch { /* ignore */ }
    // Watchdog: if the host goes silent, migrate.
    clearInterval(state.watchdogTimer);
    state.watchdogTimer = setInterval(() => {
      if (now() - state.lastHostBeat > HOST_TIMEOUT_MS) onHostLost();
    }, HEARTBEAT_MS);
  }

  // Host migration: when the host drops, the remaining players deterministically pick the next host (lowest id
  // among those still present) — the same rule everyone can compute locally, so they agree without a round-trip.
  // The new host re-registers with the server so the GameSession keeps a correct record.
  async function onHostLost() {
    clearInterval(state.watchdogTimer);
    emit("host_lost");
    const survivors = getKnownPeers().filter((id) => id !== state.hostId).sort();
    const next = survivors[0];
    if (!next) { state.role = "server"; emit("role"); return; } // no one left → fall back to server
    if (next === state.selfId) {
      // I'm the new host — tell the server to reassign, then host.
      const res = await base44.functions.invoke("sessionHostAssign", {
        room_id: state.roomId, self_player_id: state.selfId,
        players: getKnownPeers().map((id) => ({ id, hostScore: id === state.selfId ? 100 : 50 })),
      }).catch(() => null);
      if (res?.session_id) state.sessionId = res.session_id;
      becomeHost();
    } else {
      becomePeer(next);
    }
    emit("role");
  }

  // Peers we know about (populated by transport messages). Kept simple; a real transport supplies presence.
  const knownPeers = new Set();
  function getKnownPeers() { const s = new Set(knownPeers); if (state.selfId) s.add(state.selfId); return [...s]; }

  // Wire incoming transport messages into the coordination logic.
  transport?.onMessage?.((msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.hostId) knownPeers.add(String(msg.hostId));
    if (msg.from) knownPeers.add(String(msg.from));
    if (msg.type === "host_beat" && String(msg.hostId) === state.hostId) state.lastHostBeat = now();
    if (msg.type === "state" && state.role === "peer") { state.gameState = msg.state; emit("state"); }
    if (msg.type === "join" && msg.from) knownPeers.add(String(msg.from));
  });

  /** Host updates the disposable session state and broadcasts it to peers. */
  function setGameState(next) {
    if (state.role !== "host") return;
    state.gameState = next;
    transport?.send?.({ type: "state", sessionId: state.sessionId, state: next, from: state.selfId, t: now() });
    emit("state");
  }

  /** Finish the session and finalize the reward — ALWAYS via the server, which recomputes + caps it. The score
   *  passed here is only a CLAIM; the server decides what's real. Returns the server's validation result. */
  async function finishAndClaimReward({ score, durationSeconds }) {
    stopTimers();
    const res = await base44.functions.invoke("sessionRewardValidate", {
      session_id: state.sessionId, player_id: state.selfId,
      score: Number(score) || 0, duration_s: Number(durationSeconds) || 0,
    }).catch((e) => ({ ok: false, reasons: [String(e?.message || e)] }));
    emit("finished");
    return res; // { ok, accepted_reward, computed_reward, reasons }
  }

  // ── Recording & clips (record / save-a-clip capabilities) ─────────────────────────────────────────────────
  // Records a MediaStream (screen share or a game <canvas>.captureStream()) with MediaRecorder. On stop it hands
  // you a Blob; you upload it to object storage via your `uploader` and this registers the metadata server-side
  // (which holds it pending moderation before anyone can replay it). Clips keep a rolling in-memory buffer so
  // "save the last N seconds" is instant. Participants were told at join the session may be recorded (consent).
  function _mimeType() {
    const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    try { return cands.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "video/webm"; } catch { return "video/webm"; }
  }
  /** Start recording a stream (defaults to the active screen share). For clips, pass { rolling: true, clipSeconds }. */
  function startRecording(stream, { rolling = false, clipSeconds = 30, timesliceMs = 1000 } = {}) {
    const src = stream || state.screenStream;
    if (!src || typeof MediaRecorder === "undefined") return { ok: false, reason: "no stream or MediaRecorder unsupported" };
    try {
      const rec = new MediaRecorder(src, { mimeType: _mimeType() });
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return;
        chunks.push({ t: now(), data: e.data });
        if (rolling) { const cutoff = now() - clipSeconds * 1000; while (chunks.length > 1 && chunks[0].t < cutoff) chunks.shift(); }
      };
      rec.start(timesliceMs);
      state.recorder = { rec, chunks, rolling, clipSeconds, startedAt: now() };
      emit("recording_on");
      return { ok: true };
    } catch (e) { return { ok: false, reason: String(e?.message || e) }; }
  }
  /** Stop recording and get the Blob. Does NOT upload — hand the Blob to your storage uploader, then call
   *  registerRecording(url, ...). */
  async function stopRecording() {
    const r = state.recorder; if (!r) return { ok: false, reason: "not recording" };
    return new Promise((resolve) => {
      r.rec.onstop = () => {
        const blob = new Blob(r.chunks.map((c) => c.data), { type: _mimeType() });
        const duration_s = Math.max(0, Math.round((now() - r.startedAt) / 1000));
        state.recorder = null; emit("recording_off");
        resolve({ ok: true, blob, duration_s, kind: "recording" });
      };
      try { r.rec.stop(); } catch { resolve({ ok: false, reason: "stop failed" }); }
    });
  }
  /** Save the last `clipSeconds` as a clip Blob (requires startRecording({rolling:true})). */
  function saveClip() {
    const r = state.recorder; if (!r || !r.rolling) return { ok: false, reason: "clips need startRecording({ rolling: true })" };
    const blob = new Blob(r.chunks.map((c) => c.data), { type: _mimeType() });
    emit("clip_saved");
    return { ok: true, blob, kind: "clip", clipSeconds: r.clipSeconds };
  }
  /** Register an uploaded recording/clip (URL in object storage) with the server (stored pending moderation). */
  async function registerRecording(url, { kind = "recording", durationSeconds = 0 } = {}) {
    return base44.functions.invoke("sessionRecording", {
      action: "register", session_id: state.sessionId, url, kind, duration_s: durationSeconds, consented: true,
    }).catch((e) => ({ ok: false, reason: String(e?.message || e) }));
  }
  /** List approved recordings for replay / on-demand. */
  async function listRecordings() {
    return base44.functions.invoke("sessionRecording", { action: "list", session_id: state.sessionId }).catch(() => ({ ok: false, recordings: [] }));
  }

  // ── On-demand feed (late joiners request the live stream) ─────────────────────────────────────────────────
  // Coordination only; the actual media renegotiation happens in your transport. A late viewer calls
  // requestFeed(); the host's onFeedRequest hook (set via transport) answers with a fresh offer.
  function requestFeed(fromPeerId) { try { transport?.send?.({ type: "feed_request", from: fromPeerId || state.selfId, sessionId: state.sessionId }); } catch { /* ignore */ } }

  // ── Remote control / co-op (scoped to game input) ─────────────────────────────────────────────────────────
  // Server is the authority on who holds control (sessionControl). The host grants; the grantee's inputs are
  // relayed over the transport and applied ONLY to game state. applyRemoteInput refuses anything that isn't a
  // game input, so a co-op grant can never reach navigation/account/money.
  async function grantControl(granteePlayerId, scope = "game_input") {
    const res = await base44.functions.invoke("sessionControl", { action: "grant", session_id: state.sessionId, grantee_player_id: granteePlayerId, scope }).catch((e) => ({ ok: false, reason: String(e?.message || e) }));
    if (res?.ok) { state.controlHolder = granteePlayerId; emit("control"); }
    return res;
  }
  async function revokeControl() {
    const res = await base44.functions.invoke("sessionControl", { action: "revoke", session_id: state.sessionId }).catch(() => ({ ok: false }));
    if (res?.ok) { state.controlHolder = null; emit("control"); }
    return res;
  }
  function requestControl(scope = "game_input") { try { transport?.send?.({ type: "control_request", from: state.selfId, scope, sessionId: state.sessionId }); } catch { /* ignore */ } }
  /** Apply a remote input from the current control-holder — GAME INPUT ONLY. Anything else is dropped. The host
   *  passes a handler that mutates game state; this wrapper enforces the scope. */
  function applyRemoteInput(fromPeerId, input, gameInputHandler) {
    if (state.role !== "host") return { applied: false, reason: "only the host applies inputs" };
    if (String(state.controlHolder || "") !== String(fromPeerId)) return { applied: false, reason: "sender does not hold control" };
    if (!input || input.kind !== "game_input") return { applied: false, reason: "non-game input refused (scope is game_input only)" };
    try { gameInputHandler?.(input); return { applied: true }; } catch (e) { return { applied: false, reason: String(e?.message || e) }; }
  }

  function stopTimers() { clearInterval(state.heartbeatTimer); clearInterval(state.watchdogTimer); clearInterval(state.timerTimer); }
  function leave() { stopTimers(); stopScreenShare(); try { state.recorder?.rec?.stop?.(); } catch { /* ignore */ } state.recorder = null; try { transport?.stop?.(); } catch { /* ignore */ } state.role = "idle"; emit("role"); }

  return {
    join, leave, setGameState, finishAndClaimReward, onEvent,
    getElapsedSeconds, startTimer, stopTimer, startScreenShare, stopScreenShare,
    startRecording, stopRecording, saveClip, registerRecording, listRecordings,
    requestFeed, grantControl, revokeControl, requestControl, applyRemoteInput,
    get role() { return state.role; }, get sessionId() { return state.sessionId; },
    get hostId() { return state.hostId; }, get gameState() { return state.gameState; },
    get contentType() { return state.contentType; }, get timed() { return state.timed; },
    get screenStream() { return state.screenStream; }, get capabilities() { return state.capabilities || []; },
    get controlHolder() { return state.controlHolder || null; },
  };
}
