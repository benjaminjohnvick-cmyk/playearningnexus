// local-db.js — a small IndexedDB-backed store on the user's DEVICE. This is "use the phone's storage" done the
// safe way: it holds ONLY things that are safe to keep on hardware the user controls —
//   • the user's OWN data (their dashboard, their history), and
//   • PUBLIC read-only reference data (the product catalog, categories, public listings),
// so those load instantly and work offline. It is NEVER the source of truth, NEVER holds another user's private
// data, and NEVER holds balances/identity a device could tamper with — that stays server-authoritative. Think of
// it as a fast local READ copy that syncs from the server, not a database the platform depends on.
//
// If IndexedDB is missing or blocked (private mode, old webview), every call transparently falls back to an
// in-memory Map for the session, so callers never have to branch.

const DB_NAME = "gg_local";
const DB_VERSION = 1;
// reads  = cached read responses (stale-while-revalidate), keyed by request
// own    = this user's own records
// catalog= public, read-only reference data downloaded for offline browsing
// meta   = sync cursors / bookkeeping
const STORES = ["reads", "own", "catalog", "meta"];

const mem = { reads: new Map(), own: new Map(), catalog: new Map(), meta: new Map() };
let _dbp = null;

function engine() { try { return typeof indexedDB !== "undefined" ? indexedDB : null; } catch { return null; } }

function openDB() {
  if (_dbp) return _dbp;
  const idb = engine();
  if (!idb) { _dbp = Promise.resolve(null); return _dbp; }
  _dbp = new Promise((resolve) => {
    let req;
    try { req = idb.open(DB_NAME, DB_VERSION); } catch { return resolve(null); }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return _dbp;
}

function validStore(store) { return STORES.includes(store); }

/** Put a value under a key. Falls back to memory on any failure. Resolves true always (best-effort store). */
export async function put(store, key, value) {
  if (!validStore(store)) return false;
  const db = await openDB();
  if (!db) { mem[store].set(String(key), value); return true; }
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).put(value, String(key));
      t.oncomplete = () => resolve(true);
      t.onerror = () => { mem[store].set(String(key), value); resolve(true); };
      t.onabort = () => { mem[store].set(String(key), value); resolve(true); };
    } catch { mem[store].set(String(key), value); resolve(true); }
  });
}

/** Get a value by key, or null. */
export async function get(store, key) {
  if (!validStore(store)) return null;
  const db = await openDB();
  if (!db) return mem[store].get(String(key)) ?? null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readonly");
      const r = t.objectStore(store).get(String(key));
      r.onsuccess = () => resolve(r.result ?? mem[store].get(String(key)) ?? null);
      r.onerror = () => resolve(mem[store].get(String(key)) ?? null);
    } catch { resolve(mem[store].get(String(key)) ?? null); }
  });
}

/** Get every value in a store (used for offline catalog browsing). */
export async function getAll(store) {
  if (!validStore(store)) return [];
  const db = await openDB();
  if (!db) return [...mem[store].values()];
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readonly");
      const r = t.objectStore(store).getAll();
      r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
      r.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

export async function del(store, key) {
  if (!validStore(store)) return false;
  const db = await openDB();
  if (!db) { mem[store].delete(String(key)); return true; }
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).delete(String(key));
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(true);
    } catch { resolve(true); }
  });
}

export async function clear(store) {
  if (!validStore(store)) return false;
  const db = await openDB();
  if (!db) { mem[store].clear(); return true; }
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).clear();
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(true);
    } catch { resolve(true); }
  });
}

/** Store a read response with a timestamp (for stale-while-revalidate). */
export async function putRead(key, value) { return put("reads", key, { t: Date.now(), v: value }); }

/** Get a cached read; returns { v, age, stale } or null. `maxAgeMs` decides staleness (not expiry — a stale
 *  value is still returned for offline use, just flagged so the UI can show "updating…"). */
export async function getRead(key, maxAgeMs = 5 * 60 * 1000) {
  const r = await get("reads", key);
  if (!r || typeof r !== "object" || !("v" in r)) return null;
  const age = Date.now() - (Number(r.t) || 0);
  return { v: r.v, age, stale: age > maxAgeMs };
}

/** Best-effort device storage usage (for the maintenance/self-heal health report). */
export async function usage() {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0, pct: e.quota ? Math.round((e.usage / e.quota) * 100) : 0 };
    }
  } catch { /* ignore */ }
  return { usage: 0, quota: 0, pct: 0 };
}

export function available() { return !!engine(); }
