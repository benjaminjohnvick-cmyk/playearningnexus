# Scaling bottlenecks & fixes (running log)

A record of the code-level scaling work — what the bottleneck was, and the fix. All fixes are code-only
(no infra change required) and preserve existing behavior/compliance. Verified by `deploy-kit/load-test.mjs`.

## 1. QVC-scale broadcast video — one feed, huge audience (done earlier)

The mass PASSIVE audience is served HLS off a CDN instead of individual WebRTC subscriptions, so one feed
scales to essentially unlimited concurrent viewers with zero SFU load. See `QVC-SCALE-BROADCAST.md`.

## 2. Broadcast metadata poll → CDN (done)

HLS viewers can't get the host's in-room "feature this product / ad break" data ping, so they poll
`sessionFeatured`. Naively that's one origin hit per viewer per tick. Fix: the GET is short-cache + SWR
(`max-age=3, stale-while-revalidate=15`) so an edge collapses a burst to ~one origin hit every few seconds,
and viewers prefer a static CDN `state.json` (`stateUrlForRoom`) that scales like the video. Publishing
`state.json` from the host/egress side is the switch that lights the CDN path fully; until then the SWR-cached
origin already removes the per-viewer cost.

## 3. Leaderboard global board — precompute instead of per-request scan (done)

The global friendly-competition board recomputed on every request, loading up to 50k `DailyEarnings` /
5k `User` / 50k `Referral` rows into memory each call. Fix: a scheduled `leaderboardSnapshot` job (every 15 min)
precomputes the ranking per metric with bounded-memory `db.scan()` and stores one `LeaderboardSnapshot` row per
metric (top 2000, admin-scoped). The `leaderboard` function serves GLOBAL scope from that snapshot (one indexed
row read) and FRIENDS scope from tight `$in`-scoped queries over the small friend set. Financial metrics stay
RANK-ONLY. A bounded on-the-fly fallback covers the window before the first snapshot exists.

## 4. Ad-break burst — collapse the thundering herd (done)

When a host advances to the next product, EVERY viewer's client calls `sessionAdBreak` within a couple of
seconds, and each ad pick re-read the same shared inventory (active `AdGridAd` creatives — unbounded — plus the
founding/earned/make-good owner sets and the AI targeting model). A 100k-viewer break was ~100k identical reads
in a burst. Fix: a small in-process TTL cache with **single-flight** (`backend/sdk/ttl-cache.ts`) fronts those
shared, slow-changing reads in `pickInterstitialAd`, so within a warm isolate N concurrent callers collapse to
ONE loader call and everything within the TTL is served with no DB hit. The per-USER work (targeting match +
learned ranking) still runs every call on the cached in-memory array — who sees which ad is unchanged. The
active-ad load is also capped (`ADS_ACTIVE_MAX`, default 5000). This same selector backs the survey, in-app,
and premium ad-free interstitials, so all four placements benefit. Tunable via `AD_BURST_CACHE_MS` (default 15s).

## 5. Go-live token burst — cached lookup + atomic SFU-cap counter (done)

When a stream goes live (or a popular one is found), a crowd requests LiveKit tokens at once, each reading the
same room's `GameSession` row and then doing a **read-then-write** on `viewer_tokens`. Two problems: (a) the
identical reads were a burst, and (b) the counter had a lost-update race — every racer read the same value and
wrote value+1, so the counter never caught up and the SFU cap could be blown right through. Fix: the per-room
lookup is served from the burst cache (single-flight), and WebRTC admission now **reserves the slot atomically**
with `db.incrementField`, releasing (atomic −1) and returning 409 when over cap. The bulk of any big crowd takes
the read-only HLS path and never touches the counter at all. Tunable via `SESSION_LOOKUP_CACHE_MS` (default 2s).

## 6. Other live-session counter races made atomic (done)

- **Featured-product "interested" tally** (`sessionFeatured`): a burst of taps could lose updates via
  read-then-write → now `db.incrementField(... "interest_count", 1)`.
- **Distinct-reporter set** (`sessionReport`): concurrent reports from different viewers could drop each other,
  stalling the auto-suspend threshold → new atomic `db.appendToSetArray` (add-if-absent) keeps the distinct
  count race-safe.

## Reusable primitives added

- `backend/sdk/ttl-cache.ts` — `cached(key, ttlMs, loader)` with single-flight; `invalidate(key)`; bounded `sweep`.
- `backend/sdk/db.ts` — `appendToSetArray(entity, id, field, value)` (atomic add-if-absent to a JSONB array).

## Candidates noted but NOT changed (lower priority, non-live-burst)

Several dashboard/aggregation endpoints (`funnelBenchmarkCompile`, `productStatsCompile`, `aiConceptPollResults`,
`platformInsights`, `feedbackStatus`, `trendChoiceResults`, `endorserRewardSweep`) do large filters. They are
infrequent (admin/scheduled/dashboard) rather than live-event bursts, so they were left as-is to avoid changing
aggregation semantics. If any becomes a hot per-user path, the same `cached()` + `db.scan()`/`db.count()`
patterns apply.
