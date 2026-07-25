// Cache adapter — DORMANT scale scaffolding, behind a flag. No behaviour or cost change
// until you set REDIS_URL.
//
//   • No REDIS_URL (default)  → process-local in-memory cache. Works on a single instance;
//                                each instance has its own copy. Zero new infra, zero cost.
//   • REDIS_URL set           → shared Redis (e.g. ElastiCache). Turns hot reads (prize pool,
//                                leaderboard, rate-limit counters) into one Redis hit instead
//                                of hammering Postgres. This is the flip you make when traffic
//                                justifies it — no call-site changes.
//
// Every function is best-effort and never throws to the caller: a cache miss or a Redis
// hiccup must degrade to "just read the source", never break a request. Nothing calls this
// yet — it's wired and ready so scaling is a config flip, not a code change.

const REDIS_URL = Deno.env.get("REDIS_URL");

type Entry = { v: string; exp: number }; // exp = epoch ms, 0 = no expiry
const mem = new Map<string, Entry>();

// Lazily-created Redis client (only when REDIS_URL is set). Typed loosely so the npm
// client stays an optional, dynamically-imported dependency — the in-memory path has no deps.
// deno-lint-ignore no-explicit-any
let redis: any = null;
let redisTried = false;

async function getRedis(): Promise<unknown> {
  if (!REDIS_URL) return null;
  if (redisTried) return redis;
  redisTried = true;
  try {
    const mod = await import("npm:ioredis");
    const Redis = mod.default ?? mod;
    redis = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
    redis.on?.("error", () => {/* swallow; we fall back to in-memory */});
  } catch (_e) {
    redis = null; // ioredis not installed / unreachable → stay in-memory
  }
  return redis;
}

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp && e.exp <= Date.now()) { mem.delete(key); return null; }
  return e.v;
}

/** Get a cached JSON value, or null on miss/error. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    // deno-lint-ignore no-explicit-any
    const raw = r ? await (r as any).get(key) : memGet(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

/** Set a cached JSON value with a TTL in seconds (default 30s). Best-effort. */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    const r = await getRedis();
    if (r) {
      // deno-lint-ignore no-explicit-any
      await (r as any).set(key, raw, "EX", Math.max(1, ttlSeconds));
    } else {
      mem.set(key, { v: raw, exp: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0 });
    }
  } catch { /* best-effort */ }
}

/** Delete a cached key. Best-effort. */
export async function cacheDel(key: string): Promise<void> {
  try {
    const r = await getRedis();
    // deno-lint-ignore no-explicit-any
    if (r) await (r as any).del(key); else mem.delete(key);
  } catch { /* best-effort */ }
}

/** Read-through helper: return the cached value, or compute + cache it on a miss. */
export async function cached<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const val = await produce();
  await cacheSet(key, val, ttlSeconds);
  return val;
}

/** True when a shared cache is configured (Redis). Lets callers log which mode they're in. */
export function cacheIsShared(): boolean { return !!REDIS_URL; }
