// resilient-mode.js — client-side automatic fallback to ON-DEVICE mode when the server is stressed or offline.
//
// When systemLoadSignal reports "degraded"/"overloaded" (or the network fails), the app automatically shifts to
// serving reads/UI from a LOCAL cache on the device and QUEUES non-sensitive writes to sync when the server
// recovers — so a traffic spike or a blip becomes "works read-only from your device", not "site down". When the
// signal returns to "normal", it flushes the queue (idempotently) and resumes online.
//
// HARD RULE (do not remove): SENSITIVE actions — payout, purchase, balance change, KYC, anything money/identity/
// legal — are NEVER run on-device and NEVER queued. They require the online, server-authoritative path + step-up.
// In fallback they are blocked with a "try again in a moment" so stale local state can never move real value.
//
// This is framework-agnostic. Wire it once at app start: `initResilientMode(base44)`. Pair with a PWA service
// worker (see AI-SCALING-AGENT.md) for true offline caching of the app shell.

const SENSITIVE = new Set([
  "requestPayout", "requestManualPayout", "cashappPayout", "paypalPayout", "venmoPayout", "processRewardPayout",
  "assistedCheckout", "placeStoreOrder", "advanceGrant", "moneyTransfer", "submitTaxInfo", "kyc",
]);

const state = {
  mode: "normal",            // "normal" | "degraded" | "overloaded"
  base44: null,
  queue: [],                 // pending non-sensitive writes
  listeners: new Set(),
};

function loadQueue() {
  try { state.queue = JSON.parse(localStorage.getItem("rm_write_queue") || "[]"); } catch { state.queue = []; }
}
function saveQueue() {
  try { localStorage.setItem("rm_write_queue", JSON.stringify(state.queue.slice(0, 500))); } catch { /* ignore */ }
}
function cacheRead(key, value) {
  try { localStorage.setItem("rm_cache_" + key, JSON.stringify({ t: Date.now(), v: value })); } catch { /* ignore */ }
}
export function getCachedRead(key) {
  try { const r = JSON.parse(localStorage.getItem("rm_cache_" + key) || "null"); return r ? r.v : null; } catch { return null; }
}
export function onModeChange(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); }
function setMode(m) { if (m !== state.mode) { state.mode = m; state.listeners.forEach((f) => { try { f(m); } catch { /* ignore */ } }); } }
export function currentMode() { return state.mode; }

/** Poll the server's load signal and set the mode. Falls back to "degraded" if the signal itself is unreachable. */
async function pollSignal() {
  try {
    const res = await state.base44.functions.invoke("systemLoadSignal", {});
    const s = res?.state || "normal";
    setMode(s);
    if (s === "normal" && state.queue.length) flushQueue();
  } catch {
    setMode("degraded");   // can't even reach the signal → assume degraded, lean on local cache
  }
}

/** A read that transparently uses the local cache during fallback (and refreshes it when online). */
export async function resilientRead(fnName, payload, cacheKey) {
  const key = cacheKey || `${fnName}:${JSON.stringify(payload || {})}`;
  if (state.mode !== "normal") {
    const cached = getCachedRead(key);
    if (cached != null) return { fromCache: true, data: cached };
  }
  try {
    const res = await state.base44.functions.invoke(fnName, payload || {});
    cacheRead(key, res);
    return { fromCache: false, data: res };
  } catch {
    const cached = getCachedRead(key);
    if (cached != null) return { fromCache: true, data: cached };
    throw new Error("offline and no cached copy");
  }
}

/** A write. SENSITIVE writes are refused in fallback (must be online + step-up). Non-sensitive writes are
 *  queued when overloaded and flushed on recovery, with a client idempotency key so they apply exactly once. */
export async function resilientWrite(fnName, payload) {
  if (SENSITIVE.has(fnName)) {
    if (state.mode !== "normal") {
      return { blocked: true, reason: "This action needs to be online and verified — please try again in a moment.", sensitive: true };
    }
    return { blocked: false, data: await state.base44.functions.invoke(fnName, payload || {}) };
  }
  if (state.mode === "overloaded") {
    const item = { fnName, payload: payload || {}, idempotency_key: `rm_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    state.queue.push(item); saveQueue();
    return { queued: true, idempotency_key: item.idempotency_key };
  }
  return { queued: false, data: await state.base44.functions.invoke(fnName, { ...(payload || {}), idempotency_key: `rm_${Date.now()}` }) };
}

/** Flush queued non-sensitive writes when the server is healthy again. Idempotency keys make replay safe. */
export async function flushQueue() {
  if (!state.queue.length) return;
  const pending = [...state.queue];
  for (const item of pending) {
    try {
      await state.base44.functions.invoke(item.fnName, { ...item.payload, idempotency_key: item.idempotency_key });
      state.queue = state.queue.filter((q) => q.idempotency_key !== item.idempotency_key);
      saveQueue();
    } catch { /* keep it queued; try again next recovery */ }
  }
}

/** Start it. Polls every `intervalMs` (default 15s) and reacts to browser online/offline events. */
export function initResilientMode(base44, { intervalMs = 15000 } = {}) {
  state.base44 = base44;
  loadQueue();
  pollSignal();
  setInterval(pollSignal, intervalMs);
  if (typeof window !== "undefined") {
    window.addEventListener("offline", () => setMode("degraded"));
    window.addEventListener("online", () => pollSignal());
  }
  return { currentMode, resilientRead, resilientWrite, flushQueue, onModeChange };
}
