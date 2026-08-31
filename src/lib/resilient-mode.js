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

import * as localDb from "./local-db.js";

const SENSITIVE = new Set([
  "requestPayout", "requestManualPayout", "cashappPayout", "paypalPayout", "venmoPayout", "processRewardPayout",
  "assistedCheckout", "placeStoreOrder", "advanceGrant", "moneyTransfer", "submitTaxInfo", "kyc",
]);

// SENSITIVE READS — money/identity reads that must ALWAYS come live from the server, never from the on-device
// copy. A stale local balance could mislead a purchase decision, so these bypass the offline-first path entirely
// and fail closed (throw) rather than show a cached number. Extend as needed.
const SENSITIVE_READ = new Set([
  "getBalance", "walletBalance", "getWallet", "siteCashBalance", "payoutStatus", "getPayouts",
  "taxInfo", "getTaxInfo", "kycStatus", "getKyc", "advanceStatus", "getStatement",
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

// ── Offline-first reads from the on-device store (IndexedDB) ────────────────────────────────────────────────
// This is the "use the phone's storage / download the safe slice" feature, done safely. For NON-sensitive reads
// of the user's own data or public reference data, it serves instantly from the device copy and revalidates from
// the server in the background (stale-while-revalidate). Money/identity reads are refused here and must go live.
//
// Returns { data, fromLocal, stale }. A caller can render `data` immediately and, if `stale`, show a subtle
// "updating…" until the background refresh lands (subscribe via onModeChange or just re-read).
export async function offlineFirstRead(fnName, payload, { store = "reads", ttlMs = 5 * 60 * 1000 } = {}) {
  if (SENSITIVE_READ.has(fnName)) {
    // Never serve money/identity from the device copy — always live, fail closed if offline.
    return { data: await state.base44.functions.invoke(fnName, payload || {}), fromLocal: false, stale: false };
  }
  const key = `${fnName}:${JSON.stringify(payload || {})}`;
  const cached = await localDb.getRead(key, ttlMs).catch(() => null);

  const refresh = async () => {
    try {
      const res = await state.base44.functions.invoke(fnName, payload || {});
      await localDb.putRead(key, res).catch(() => {});
      if (store !== "reads") await localDb.put(store, key, res).catch(() => {});
      return res;
    } catch { return null; }
  };

  // Have a local copy: return it now. Refresh in the background only when the server is healthy.
  if (cached && cached.v != null) {
    if (state.mode === "normal") refresh();
    return { data: cached.v, fromLocal: true, stale: cached.stale };
  }
  // No local copy: fetch, store, return. If the network fails and we truly have nothing, surface that.
  const fresh = await refresh();
  if (fresh != null) return { data: fresh, fromLocal: false, stale: false };
  throw new Error("offline and no local copy on this device yet");
}

/** Download a PUBLIC, read-only slice (e.g. the product catalog) onto the device for offline browsing. This is
 *  the safe form of "download the database": only public reference data, never other users' private data. Pass
 *  the read function that returns the slice; its result is stored in the `catalog` store. */
export async function prefetch(fnName, payload, { store = "catalog" } = {}) {
  if (SENSITIVE.has(fnName) || SENSITIVE_READ.has(fnName)) return { ok: false, reason: "refused: not public data" };
  try {
    const res = await state.base44.functions.invoke(fnName, payload || {});
    const key = `${fnName}:${JSON.stringify(payload || {})}`;
    await localDb.put(store, key, res).catch(() => {});
    await localDb.putRead(key, res).catch(() => {});
    return { ok: true, key };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

/** Read a previously-prefetched public slice from the device (for offline catalog browsing). */
export async function readPrefetched(fnName, payload, { store = "catalog" } = {}) {
  const key = `${fnName}:${JSON.stringify(payload || {})}`;
  return localDb.get(store, key);
}

// ── On-device self-heal (the LOCAL, non-authoritative tier of maintenance) ──────────────────────────────────
// The server-side maintenance agent (maintenanceAgentRun) owns authoritative health — data hygiene, job retries,
// anything shared. This is its counterpart INSIDE the app on a user's phone/desktop: it only ever fixes the
// LOCAL app so the device experience stays smooth during a spike or a blip. It never mutates shared state and
// never touches anything sensitive — the SENSITIVE guard above still blocks money/identity in every mode. What
// it does: drop corrupt local-cache entries, discard a runaway write queue, re-register the service worker if the
// app shell broke, and flush the queue on recovery. Returns a small client-health object for optional telemetry.
export function deviceSelfHeal() {
  const health = { checkedAt: Date.now(), cacheDropped: 0, queueTrimmed: 0, swReregistered: false, ok: true, mode: state.mode };
  try {
    // 1) Cache integrity: remove any rm_cache_* entry that no longer parses or lost its shape (corruption/partial write).
    if (typeof localStorage !== "undefined") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("rm_cache_")) continue;
        try {
          const r = JSON.parse(localStorage.getItem(k) || "null");
          if (!r || typeof r !== "object" || !("v" in r)) { localStorage.removeItem(k); health.cacheDropped++; }
        } catch { localStorage.removeItem(k); health.cacheDropped++; }
      }
    }
    // 2) Queue sanity: never let the local write queue grow unbounded (a stuck overloaded device could pile up).
    if (state.queue.length > 500) { state.queue = state.queue.slice(-500); saveQueue(); health.queueTrimmed = 1; }
    // 3) App shell: if the service worker died, re-register it so offline caching keeps working.
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) { navigator.serviceWorker.register("/sw.js").then(() => {}).catch(() => {}); health.swReregistered = true; }
      }).catch(() => {});
    }
    // 4) On recovery, flush anything queued.
    if (state.mode === "normal" && state.queue.length) flushQueue();
  } catch (e) {
    health.ok = false;
  }
  return health;
}

/** Start it. Polls every `intervalMs` (default 15s) and reacts to browser online/offline events. Also runs the
 *  on-device self-heal at start and whenever the app recovers to normal, so the local app repairs itself. */
export function initResilientMode(base44, { intervalMs = 15000, selfHeal = true } = {}) {
  state.base44 = base44;
  loadQueue();
  if (selfHeal) {
    // Self-heal at boot, and again each time we transition back to normal (recovery is when a flush/repair helps).
    try { deviceSelfHeal(); } catch { /* ignore */ }
    onModeChange((m) => { if (m === "normal") { try { deviceSelfHeal(); } catch { /* ignore */ } } });
  }
  pollSignal();
  setInterval(pollSignal, intervalMs);
  if (typeof window !== "undefined") {
    window.addEventListener("offline", () => setMode("degraded"));
    window.addEventListener("online", () => pollSignal());
  }
  return {
    currentMode, resilientRead, resilientWrite, flushQueue, onModeChange, deviceSelfHeal,
    offlineFirstRead, prefetch, readPrefetched, localDb,
  };
}
