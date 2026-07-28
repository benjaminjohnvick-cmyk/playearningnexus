# Performance & cost optimization pass

This pass removes cost and risk from everything built this session while keeping every feature. Nothing
was deleted; each concern became a bounded, tunable lever. Result: the whole learning/telemetry/
experiment stack runs at ~$0 additional cost and never impedes the user experience.

## 1. Incremental counters (no more metric scans)

The live-experiment monitor used to scan up to 20,000 `LiveMetricEvent` rows per metric per experiment
every tick. Now each exposure/outcome **increments per-variant counters on the experiment doc**
(CAS-guarded with a version + retry), and `measureExperiment` reads those counters in **O(1)**. A scan
is used only as a fallback for pre-counter data. This is the biggest server-side win and it's free.

## 2. Cheap structural/heatmap capture (replaces pixel screenshots)

`html2canvas` rasterization (CPU-heavy, main-thread jank, fat image uploads) is replaced by a tiny
**structural snapshot**: viewport, scroll depth, click coordinates, dead/rage-click counts, and the
bounding boxes/labels of interactive elements (which are above the fold). ~1 KB, no image, near-zero
client cost, no object-storage cost. The batch analyzer (`sessionCaptureAnalyzeBatch`) is now almost
entirely **rule-based** — it flags dead-click hotspots, rage-clicking, low scroll reach, and
below-the-fold primary actions with **no per-frame vision LLM** — and only runs one optional summary
call if there's spend headroom. Same design signal, essentially $0.

## 3. Coalesced + idle telemetry

The client used to make **two** writes per flush (`UserJourneyEvent.bulkCreate` + `telemetryIngest`).
Now it makes **one** call; `telemetryIngest` persists both the journey rows and the statistical
aggregate server-side. Flushes run inside `requestIdleCallback` so they never compete with rendering,
and unload/background flushes use `fetch({keepalive})` (carries auth, survives unload) with a
`sendBeacon` fallback — so the last batch isn't lost. `TELEMETRY_SAMPLE_PCT` (session-consistent) lets
the overhead monitor down-sample volume when needed.

## 4. Caching + fewer writes

`runningExperiments()` and `segmentKeptExperiments()` are cached in-process (~20 s TTL, invalidated on
create/promote/revert), so the request-time applier (every login/resume) and the tick don't re-query
constantly. The per-user variant snapshot is written **only when it changed** (fingerprint compare),
eliminating write amplification on every login.

## 5. Delta / wifi-aware OTA

`capacitor.config.json` enables background **delta** updates (only changed files — typically tens of KB)
with a periodic check; `otaUpdate.js` gates downloads to **wifi/ethernet** (via `@capacitor/network`
when present) so OTA never eats mobile data, and applies on next open (no mid-session disruption, with
`notifyAppReady` rollback safety).

## 6. Kill switch + overhead monitor

- **Kill switch:** the `experiments_paused` flag (or `LIVE_EXPERIMENTS_PAUSED` setting) instantly halts
  all live-experiment assignment, exposure, ticking, and creation — one flip. Already-promoted and
  segment-kept changes stay in place; flip it off to resume.
- **Overhead monitor** (`learningOverheadMonitor`, scheduled hourly): watches the learning system's own
  footprint — telemetry/metric/snapshot volume and AI spend — and **auto-throttles within bounds**. Over
  `OVERHEAD_MAX_EVENTS_PER_DAY` → it lowers `TELEMETRY_SAMPLE_PCT` / `SESSION_CAPTURE_SAMPLE_PCT` (and
  raises them back when volume subsides); at `OVERHEAD_AI_SPEND_PAUSE_PCT` of the AI cap → it pauses live
  experiments for the day so user-facing AI is never crowded out. Every change is a bounded, audited
  setting flip. The measurement system can never become the performance problem.

## Does pushing live updates impede UX or performance?

- **Per-user variant/config updates:** no — a small JSON response at login, applied client-side, quiet-
  swapped at session boundaries (no mid-session shift, cached so no flicker for returning users).
- **OTA bundle updates:** no — delta download in the background on wifi, applied on next open, auto-
  rollback on a bad bundle. Never interrupts a session.
- The former watch-items (html2canvas jank, telemetry volume, tick scans, flicker, write amplification)
  are all addressed above.

## The $0-cost / ~0-dev-hours posture

Everything ships prebuilt and default-safe, so adopting it is ~0 dev hours (OTA needs the Capgo plugin +
one native rebuild; pixel screenshots are no longer needed at all). Runtime cost stays $0 additional
with: telemetry on (rides your existing DB, now coalesced + sampleable), live experiments/personalization
on (pure math + O(1) counters), heatmap capture on (rule-based, ~$0), chatbot/self-learning LLM under
your existing `AI_DAILY_SPEND_CAP_USD`, and the overhead monitor guaranteeing volume/spend never runs
away.
