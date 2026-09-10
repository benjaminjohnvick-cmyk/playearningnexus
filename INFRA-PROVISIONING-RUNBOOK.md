# Infrastructure provisioning runbook

The code for every scaling lever is already wired and ships as a safe no-op (see `SCALE-FLIPS.md`). This runbook
is the **provisioning** half — standing up the actual infrastructure and getting the credentials — because that
part can't be done from inside the app. Each part ends with the **exact env block** to paste (Railway → your
service → Variables), using the precise variable names the code reads.

**What I can't do for you (and why):** create these accounts, click through your Cloudflare/Railway/Neon
consoles, or enter any credentials. Provisioning happens in *your* accounts with *your* secrets. So this is a
click-by-click runbook you follow; when you're done, paste the resulting values into the env blocks and run
`node deploy-kit/env-check.mjs` — its "Scale levers" section flips each row to **ACTIVE**.

## Recommended order (by cost vs. need)

1. **Part A — Object store + CDN (Cloudflare R2).** Cheap (R2 has no egress fees), useful immediately, and it's
   the storage half the broadcast path needs later. Do this first.
2. **Part C — LiveKit Egress + broadcast.** Only needed once live broadcast actually launches — and hosting is
   **counsel-gated OFF** (`SESSION_HOSTING_ENABLED=0`) today. Real recurring cost. **Defer until you turn
   hosting on.**
3. **Part B — Read replica.** Lowest priority: it only pays off once reads strain the primary, which is unlikely
   pre-launch. Also the one with a Railway caveat (below). Defer until a dashboard/leaderboard read load actually
   shows up in your metrics.

Cost reality check: your whole posture is the cost floor (~$5–20/mo). R2 is a few cents/GB with **zero egress
fees** (that's why it's recommended over S3 for a CDN origin). A read replica and a LiveKit Egress service each
add a standing monthly instance — don't provision them "to be safe"; provision them when the need is real.

---

## Ownership: what you provision, what the app does

**Provisioning the underlying infrastructure — a read replica, the LiveKit Egress service, and the object store
+ CDN — and obtaining its credentials is yours to do.** It happens in your own accounts, with your own secrets.
I can't do it for you and I never enter or handle secrets — not a limitation to work around, it's the correct
boundary for credentials. My side is done: every lever is wired in code and ships as a safe no-op.

**Once that infrastructure exists and you hold its credentials, `SCALE-FLIPS.md` is the turnkey checklist** —
paste each value into the env var it names, restart, and `node deploy-kit/env-check.mjs` flips the lever to
**ACTIVE**. No code change, no redeploy of logic.

### Credentials & values you must obtain (checklist)

Object store + CDN — Cloudflare R2 (Part A):
- [ ] R2 **Account ID** (for the S3 endpoint host)
- [ ] R2 **Access Key ID** + **Secret Access Key** (Object Read & Write token — secret shown once)
- [ ] Bucket **name**
- [ ] Public **custom domain** connected to the bucket (the CDN base URL)

Read replica — Neon (Part B; only when read load demands it):
- [ ] Neon primary **connection string** (`DATABASE_URL`)
- [ ] Neon **read-replica connection string** (`DATABASE_REPLICA_URL`)

LiveKit Egress + broadcast — Railway (Part C; when hosting launches):
- [ ] `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` (generated pair, shared by server + Egress)
- [ ] LiveKit server **domain** (`wss://…` → `LIVEKIT_URL`)
- [ ] Railway **account/project token** (`RAILWAY_TOKEN`) + LiveKit **service id** + **environment id**
- [ ] Egress service **URL** (`LIVEKIT_EGRESS_URL`)
- [ ] Egress storage config pointed at the **same R2 bucket + token** from Part A

Each row maps 1:1 to an env var in `SCALE-FLIPS.md`. Obtain them by following the parts below; then flip them on
from that checklist.

---

# Part A — Object store + CDN (Cloudflare R2)

R2 is S3-compatible (the app's publisher signs SigV4 for it) and has **no egress fees**, which is exactly what
you want behind a CDN serving HLS segments and media. One bucket serves both **writes** (private, via an S3 API
token) and **reads** (public, via a custom domain that's automatically on Cloudflare's CDN).

### A1. Create the bucket
1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
2. Name it e.g. `ggg-media` (or `ggg-hls`). Pick a location hint near your users. Create.
3. Copy your **Account ID** (shown on the R2 overview / account home) — you'll need it for the endpoint.

### A2. Create an S3 API token (write credentials)
1. R2 → **Manage R2 API Tokens** (under *Account details* / *API*) → **Create API token**.
2. Permission: **Object Read & Write**. Scope it to the bucket you created (least privilege).
3. Create, then **immediately copy** the **Access Key ID** and **Secret Access Key** — the secret is shown
   **only once**.
4. Your S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. R2's region is the literal string
   `auto`.

### A3. Make reads public via a custom domain (the CDN base)
R2 buckets are private by default; the CDN base for playback must be public.
1. R2 → your bucket → **Settings** → **Custom Domains** → **Connect Domain**. Enter e.g.
   `cdn.yourdomain.com` (the domain must be on your Cloudflare account). Cloudflare provisions it and puts it
   **behind its CDN automatically**.
2. That `https://cdn.yourdomain.com` is your public base URL.
   - Quick test alternative: R2 → bucket → Settings → **Public Development URL** (r2.dev). It's **rate-limited
     and not for production** — fine to smoke-test, swap to the custom domain before launch.

### A4. Paste the env (Railway → service → Variables)
```
# HLS / broadcast-state storage (writes) — the state.json publisher + HLS origin
HLS_STORAGE_BUCKET=ggg-media
HLS_S3_ENDPOINT=<ACCOUNT_ID>.r2.cloudflarestorage.com
HLS_S3_ACCESS_KEY_ID=<r2 access key id>
HLS_S3_SECRET_ACCESS_KEY=<r2 secret access key>
HLS_S3_REGION=auto
# path-style is auto-enabled when HLS_S3_ENDPOINT is set; no need to set HLS_S3_PATH_STYLE

# Public CDN base (reads) — HLS playback + broadcast state.json are served from here
HLS_PLAYBACK_BASE_URL=https://cdn.yourdomain.com
```
Redeploy/restart, then `node deploy-kit/env-check.mjs` → **Broadcast state → CDN** should read **ACTIVE**.
(“QVC broadcast (HLS/CDN)” needs Part C's `LIVEKIT_EGRESS_URL` too before it flips.)

> **General media uploads note:** the app's *general* image/upload helper (`sdk/aws/s3.ts`, used for AI catalog
> images) currently signs the **AWS S3** host format, not a custom R2 endpoint — so it works with AWS S3 today,
> not R2. The broadcast **state.json** publisher (this scaling work) fully supports R2. If you want *all* media
> on R2 too, that's a small code change (point the upload helper at the same `presignPut` endpoint path) — ask
> and I'll wire it.

---

# Part B — Read replica (only when reads actually strain the primary)

**Railway does not offer managed read replicas** — its HA replicas are for failover only and give you no read
endpoint. So the practical path, when you actually need read offload, is a Postgres provider that offers
instant read replicas. **Neon** is the cleanest fit (serverless Postgres, one-click read replica that hands you
a separate read connection string). RDS also works (create-replica), at more ops overhead.

**Only do this when metrics show read load hurting** (slow list/leaderboard/dashboard reads while writes are
fine). Pre-launch you almost certainly don't need it — the query layer is already GIN-indexed and keyset-safe,
and the leaderboard/dashboards were moved to precompute + streaming.

### If/when you need it (Neon path)
1. Create a Neon project (or migrate your Postgres to Neon). Your primary connection string becomes
   `DATABASE_URL`.
2. Neon console → your project → **Branches/Compute** → add a **Read Replica** compute. Neon gives it its own
   connection string (a read-only endpoint).
3. Paste:
```
DATABASE_REPLICA_URL=<neon read-replica connection string>
# optional: size the replica read pool independently of the primary
PG_REPLICA_POOL_SIZE=10
```
The app auto-routes every read to the replica and **falls back to the primary if it's ever unreachable**; writes
always hit the primary. `env-check` → **DB read replica** flips to **ACTIVE**.

> Migrating off Railway Postgres is a real move — do it deliberately, with a backup + a maintenance window, only
> when the read load justifies it. Until then, leave `DATABASE_REPLICA_URL` unset (the app runs entirely on the
> primary, exactly as now).

---

# Part C — LiveKit Egress + broadcast (when hosting launches)

This lights up the QVC-scale broadcast tier. It has three pieces: the **LiveKit media server** (+ the autoscaler),
the **Egress service** (composites a room into HLS and writes segments to R2), and the **CDN** in front of R2
(Part A). Hosting is counsel-gated OFF, so **do this when you're ready to turn live broadcast on**, not before.

### C1. LiveKit media server + autoscaler
Follow `RAILWAY-LIVEKIT-DEPLOY.md` (already in the repo) end to end. It covers generating the API key/secret,
deploying LiveKit + Redis on Railway, exposing the domain, and the autoscaler's four values. Correct variable
names (the app reads these exactly):
```
LIVEKIT_URL=wss://<your-livekit-domain>
LIVEKIT_API_KEY=<from that guide's Step 0>
LIVEKIT_API_SECRET=<from that guide's Step 0>

# Autoscaler (nodes scale on live viewers, to zero at idle)
LIVEKIT_SCALE_PROVIDER=railway
RAILWAY_TOKEN=<railway account/project token>
LIVEKIT_RAILWAY_SERVICE_ID=<the LiveKit service id>
LIVEKIT_RAILWAY_ENVIRONMENT_ID=<the environment id>
# LIVEKIT_SCALE_ENABLED is already on by default; optional tuning:
# LIVEKIT_SCALE_VIEWERS_PER_NODE, LIVEKIT_SCALE_MIN_NODES, LIVEKIT_SCALE_MAX_NODES, LIVEKIT_SCALE_MONTHLY_BUDGET_USD
```

### C2. Egress service (room → HLS → R2)
Deploy **LiveKit Egress** as a second Railway service (LiveKit publishes an official `livekit/egress` image).
It needs:
- Access to the **same Redis** as the LiveKit server (Egress takes jobs off Redis) — reference the Redis
  service's `REDIS_URL`.
- The **same `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`** so it can authenticate to rooms.
- **R2 storage config** so segments land in your bucket. In the Egress config, set the S3-compatible storage to
  your R2 bucket using the Part A token: `access_key` = R2 Access Key ID, `secret` = R2 Secret,
  `region` = `auto`, `endpoint` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `bucket` = `ggg-media`,
  `force_path_style: true`.
- Expose the Egress service's HTTP port and use that URL as `LIVEKIT_EGRESS_URL`.

Then point the app at it:
```
LIVEKIT_EGRESS_URL=https://<your-egress-service-domain>
# HLS_PLAYBACK_BASE_URL + HLS_STORAGE_BUCKET are already set from Part A
HOSTING_BROADCAST_ENABLED=1        # broadcast path on (already default on)
```

### C3. Verify the full broadcast path
1. `node deploy-kit/env-check.mjs` → **QVC broadcast (HLS/CDN)** and **Broadcast state → CDN** both **ACTIVE**.
2. With `SESSION_HOSTING_ENABLED=1` (only when counsel clears it) and AI moderation on, start a hosted session,
   go broadcast (`sessionBroadcastStart`), and confirm:
   - `<bucket>/<room>/index.m3u8` + segments appear in R2 and play from `HLS_PLAYBACK_BASE_URL/<room>/index.m3u8`.
   - `<bucket>/<room>/state.json` appears and updates when the host features a product / starts an ad break.
3. `node deploy-kit/load-test.mjs` stays green (posture at the floor).

> Honest limit (from `RAILWAY-LIVEKIT-DEPLOY.md`): Railway is fine to start, but for heavy live video a cheap
> VPS pool (Hetzner/OVH/Vultr) with real UDP is more robust and cheaper on egress — switch
> `LIVEKIT_SCALE_PROVIDER` to `webhook` and point it at the pool; nothing else changes.

---

## After any part: verify

- `node deploy-kit/env-check.mjs` — the **Scale levers** section shows each provisioned lever as **ACTIVE**.
- `node deploy-kit/load-test.mjs` — posture stays at the floor.
- Nothing here changes app *logic*; each lever is env-activated, so a wrong value fails safe (the app keeps
  running on the primary DB / origin poll / WebRTC) rather than breaking.
