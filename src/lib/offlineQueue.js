// offlineQueue.js — a tiny durable queue so "earn on the go" survives dead zones. Burst completions are
// enqueued and flushed to the backend when connectivity returns. Persists to IndexedDB when available (so it
// survives a reload), falling back to in-memory. Answers still pass the backend's timing/attention checks on
// flush, so offline never means unchecked.

const DB_NAME = 'gg_offline';
const STORE = 'queue';
let mem = [];

function idb() {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE, { keyPath: 'k' }); } catch { /* ignore */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function persist(items) {
  const db = await idb();
  if (!db) { mem = items; return; }
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ k: 'items', items });
  } catch { mem = items; }
}

async function load() {
  const db = await idb();
  if (!db) return mem;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get('items');
      r.onsuccess = () => resolve(r.result?.items || []);
      r.onerror = () => resolve(mem);
    } catch { resolve(mem); }
  });
}

/** Add a payload to the queue. */
export async function enqueue(item) {
  const items = await load();
  items.push({ ...item, _ts: 'pending' });
  await persist(items);
}

/** Flush the queue: call sendFn(item) for each; keep the ones that fail. Returns count sent. */
export async function flush(sendFn) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  let items = await load();
  if (!items.length) return 0;
  const remaining = [];
  let sent = 0;
  for (const it of items) {
    try { await sendFn(it); sent++; } catch { remaining.push(it); }
  }
  await persist(remaining);
  return sent;
}

/** Auto-flush whenever the browser comes back online. */
export function onReconnect(sendFn) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => { flush(sendFn); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
