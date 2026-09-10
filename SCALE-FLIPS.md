# Scale flips — activate each lever with env (code is already wired)

Every scaling lever below is **wired in code and ships as a safe no-op**. The app runs correctly with none of
them set; setting a lever's env group turns it on with **no code change and no redeploy of logic** (just the env
+ a restart). Run `node deploy-kit/env-check.mjs` any time to see which are ACTIVE vs ready.

Order is by effort-to-payoff. None of these require entering secrets into the app UI — they're server env vars,
set wherever you host (Railway variables, a `.env`, your secrets manager).

---

## 1. DB read replica — offload every read

**Set:** `DATABASE_REPLICA_URL` = a read-replica Postgres connection string.

Every read in the app already routes through the data layer's `withReadClient`, which uses the replica when this
is set and **falls back to the primary automatically if the replica is unreachable**. Writes always go to the
primary. Nothing else to change.

- **Railway does NOT offer managed read replicas** (its HA replicas are failover-only — no read endpoint). If
  your Postgres is on Railway, the practical path is to move it to a provider with instant read replicas —
  **Neon** (one-click read replica, gives a separate read connection string) or **RDS** — when read volume
  actually demands it. See the runbook (`INFRA-PROVISIONING-RUNBOOK.md`, Part B).
- Optional: `PG_REPLICA_POOL_SIZE` (defaults to `PG_POOL_SIZE`).
- Caveat: replica lag is eventual. The app tolerates this (reads are list/dashboard/leaderboard paths); it's the
  standard read-replica tradeoff, not a bug.
- Lowest-priority lever: only pays off once reads actually strain the primary — likely not pre-launch.

## 2. LiveKit SFU autoscale — nodes scale with live viewers, to zero at idle

**Set:** `LIVEKIT_SCALE_PROVIDER=railway` **and** the Railway target (`RAILWAY_TOKEN` +
`LIVEKIT_RAILWAY_SERVICE_ID` + `LIVEKIT_RAILWAY_ENVIRONMENT_ID`) **or** `LIVEKIT_SCALE_PROVIDER=webhook` + a
node-pool `LIVEKIT_SCALE_WEBHOOK_URL` (+ `LIVEKIT_SCALE_WEBHOOK_SECRET`). The controller (`LIVEKIT_SCALE_ENABLED`) is **on by default** and scheduled
every minute — it simply no-ops until a provider + target are set. Optional tuning:
`LIVEKIT_SCALE_VIEWERS_PER_NODE`, `LIVEKIT_SCALE_MIN_NODES` / `LIVEKIT_SCALE_MAX_NODES`,
`LIVEKIT_SCALE_MONTHLY_BUDGET_USD`.

The `livekitScaleController` cron reads concurrent viewers across active sessions, computes the SFU node count
needed at the cost-floor bitrate, and sets it — scaling out under load and **in to zero when idle** (0 nodes =
$0 while hosting stays off). Safe no-op until the provider + target are set.

## 3. QVC broadcast (HLS/CDN) — one feed serves an unlimited passive crowd

**Set:** `LIVEKIT_EGRESS_URL` (your running LiveKit Egress service) **and** `HLS_PLAYBACK_BASE_URL` (your CDN
base, e.g. `https://cdn.yourdomain.com/live`), plus `HLS_STORAGE_BUCKET` (the bucket Egress writes segments to).
Requires `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (already needed for hosting).

Once set, `sessionBroadcastStart` starts a room-composite HLS egress and the token endpoint serves passive
viewers the CDN playlist (`<base>/<room>/index.m3u8`) instead of an SFU subscription — so one feed scales to a
huge audience with zero SFU load. Host + interactive guests stay on WebRTC. See `QVC-SCALE-BROADCAST.md`.

## 4. Broadcast state → CDN — the metadata poll scales with the video

**Set:** `HLS_STORAGE_BUCKET` (same bucket as #3) **and** write credentials for it:
- AWS S3: reuse `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (+ `AWS_REGION`).
- Cloudflare R2 / MinIO: `HLS_S3_ENDPOINT` (e.g. `<account>.r2.cloudflarestorage.com`),
  `HLS_S3_ACCESS_KEY_ID`, `HLS_S3_SECRET_ACCESS_KEY`, and `HLS_S3_REGION` (`auto` for R2). Path-style is enabled
  automatically when an endpoint is set (override with `HLS_S3_PATH_STYLE=1|0`).

The publisher mirrors each room's `{featured_product, ad_break_at}` to `<room>/state.json` next to the HLS
segments whenever the host features a product, starts an ad break, or starts/stops broadcast. Broadcast viewers
then poll that static object off the **CDN edge** (essentially free) instead of hitting the origin function once
per viewer. Kill switch: `BROADCAST_STATE_PUBLISH_ENABLED=0`.

Until this is set, viewers fall back to the origin poll — which is already short-cache + `stale-while-revalidate`,
so it's correct and cheap either way; this just moves the last bit of metadata load onto the edge.

**Bonus (same bucket, no extra flip):** general media uploads (AI catalog images, `UploadFile`) now share this
R2 bucket by default — with `HLS_STORAGE_BUCKET` + `HLS_S3_*` creds set, uploads land here too (under
`uploads/`/`catalog/`) and serve from the same CDN base. Override with `S3_*` to use a separate store; plain
AWS S3 still works with no endpoint set. See `INFRA-PROVISIONING-RUNBOOK.md`, Part A.

---

## What's NOT a code flip

These are genuine infra/ops actions (accounts, provisioning, DNS) — the app can't do them for you, and no
secrets should ever be entered into the app UI:

- Standing up the read replica, the LiveKit Egress service, and the object store + CDN.
- Obtaining the provider credentials above.

Once those exist, activation is purely the env flips listed here. Verify with `node deploy-kit/env-check.mjs`
(the "Scale levers" section flips each row to **ACTIVE**) and `node deploy-kit/load-test.mjs` (posture stays at
the floor).
