// ttl-cache.ts — a tiny in-process TTL cache with SINGLE-FLIGHT (in-flight dedupe), for HOT SHARED reads that a
// burst of requests would otherwise each issue against the database.
//
// The two burst cases this exists for:
//   • Ad break: when a host advances to the next product, EVERY viewer's client calls sessionAdBreak within a
//     couple of seconds. Each pick reads the same active-ad inventory / owner sets / targeting model. Without
//     this, a 100k-viewer break is 100k identical inventory reads in a burst.
//   • Go-live: when a stream goes live (or a popular one is discovered), a crowd requests LiveKit tokens at
//     once, each reading the same room's GameSession row.
//
// Within one warm isolate, N concurrent callers for the same key collapse into ONE loader call (single-flight);
// callers within the TTL get the cached value with no DB hit at all. This is NOT shared across isolates — each
// isolate caches independently — and that's exactly right: the goal is to turn a per-request read into a
// per-isolate-per-TTL read, which is the difference between a thundering herd and a trickle. Serverless keeps
// isolates warm across requests, so the cache survives between calls.
//
// Only cache SHARED, slow-changing, non-authorization-sensitive data here (ad inventory, a live room's public
// state). Never cache per-user or permission-scoped results — a short TTL would leak one user's data to another.

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Return the cached value for `key` if fresh; otherwise run `loader` (deduped across concurrent callers) and
 *  cache its result for `ttlMs`. If `loader` rejects, nothing is cached and the rejection propagates to every
 *  waiter — so give loaders their own `.catch` fallback when a failure should degrade gracefully. */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  // Single-flight: if a load for this key is already running, await it instead of starting a second one.
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return await running;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expires: Date.now() + Math.max(0, ttlMs) });
      sweep();
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return await p;
}

/** Drop a cached key (e.g. right after a write whose effect must be visible immediately). */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Bounded housekeeping so the map can't grow without limit under many distinct keys. Cheap; runs on writes. */
export function sweep(max = 500): void {
  if (store.size <= max) return;
  const now = Date.now();
  for (const [k, e] of store) if (e.expires <= now) store.delete(k);
  // Still over budget → evict oldest first (Map preserves insertion order).
  while (store.size > max) {
    const k = store.keys().next().value as string | undefined;
    if (k === undefined) break;
    store.delete(k);
  }
}
