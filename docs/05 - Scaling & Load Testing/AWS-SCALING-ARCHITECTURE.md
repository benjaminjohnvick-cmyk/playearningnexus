# GamerGain / PlayEarning Nexus — AWS Scaling Architecture (one-pager)

**Goal:** run the self-hosted stack on AWS so it comfortably serves **100,000 registered users** (≈5,000–15,000 concurrent at peak) with auto-scaling, without the database or third-party providers becoming the ceiling.

_Written July 21, 2026 for the current self-hosted stack (React frontend · Deno backend in `/backend` · PostgreSQL). A developer can build straight from this. No Base44._

---

## The shape of it

```
                          ┌─────────────┐
        Users  ──────────▶│  CloudFront │  (CDN: caches the React build + static assets)
                          └──────┬──────┘
                                 │ /api/*  and dynamic
                          ┌──────▼──────┐
                          │     ALB     │  (Application Load Balancer, HTTPS via ACM)
                          └──────┬──────┘
                                 │
                    ┌────────────▼────────────┐
                    │  ECS Fargate service     │  ◀── AUTO-SCALES (2 → N tasks)
                    │  Deno backend containers │      target-tracking on CPU + req count
                    └───┬───────────┬──────────┘
                        │           │
             reads/writes│           │ enqueue slow work
                        │           │
             ┌──────────▼───┐   ┌───▼─────────┐
             │  RDS Proxy   │   │     SQS     │  (queue for LLM / email / SMS / payouts)
             └──────┬───────┘   └───┬─────────┘
                    │               │ drained by
        ┌───────────▼──────────┐    │
        │  RDS PostgreSQL      │    ▼
        │  primary (Multi-AZ)  │  ┌──────────────────────┐
        │   + read replica(s)  │  │  Worker service      │ (ECS Fargate, separate
        └───────────┬──────────┘  │  (Deno) — calls      │  scaling; concurrency
                    │             │  OpenAI/SendGrid/    │  capped to provider tier)
             ┌──────▼──────┐      │  Twilio/Stripe       │
             │ ElastiCache │      └──────────────────────┘
             │   (Redis)   │  ◀── hot reads: leaderboard, prize-pool widget, sessions
             └─────────────┘

        S3 ── user uploads/files      CloudWatch ── logs, metrics, alarms
        Secrets Manager ── all secret env vars (never in the repo)
```

---

## Components, sizing, and why (build list)

| Layer | AWS service | Start-at sizing for 100k | Why it's here |
|---|---|---|---|
| **Frontend / CDN** | **CloudFront** + S3 origin | default | Serves the static React `dist/` globally and offloads all asset traffic from the backend. Set the SPA fallback: 403/404 → `/index.html` (200). |
| **Load balancer** | **ALB** + ACM cert | 1 | TLS termination, health checks (`/health`), routes to the Fargate service. |
| **Backend (web tier)** | **ECS Fargate** service | 2 tasks min, scale to 10–20; 1 vCPU / 2 GB each | Stateless Deno containers — the part that auto-scales linearly. This is your easy 80%. |
| **DB connection pooling** | **RDS Proxy** | 1 | **Critical.** Many containers × many connections will exhaust Postgres without pooling. RDS Proxy multiplexes them. |
| **Database (primary)** | **RDS for PostgreSQL, Multi-AZ** | `db.r6g.xlarge` (4 vCPU / 32 GB) as a starting point; size from load test | All writes. Multi-AZ = automatic failover. The one component that does **not** clone like containers. |
| **Database (reads)** | **RDS read replica(s)** | 1–2 replicas | Offload heavy reads (leaderboards, referral lookups, analytics) from the primary. Route read-only queries to replicas. |
| **Cache** | **ElastiCache (Redis)** | `cache.r6g.large`, 1 primary + 1 replica | Absorbs the hottest reads so they never hit Postgres — especially the **prize-pool widget** (15s poll) and leaderboard. Also holds sessions/rate-limit counters. |
| **Async work queue** | **SQS** (standard) + **worker Fargate service** | worker: 2–10 tasks | **Critical for a play-to-earn app.** LLM/email/SMS/payout calls go on the queue; workers drain at your provider's allowed rate. A traffic spike becomes queue depth, not failed requests. |
| **File storage** | **S3** | 1 bucket | User uploads / generated files (replaces Base44 file storage). |
| **Secrets** | **Secrets Manager** (or SSM Parameter Store) | — | Every secret env var from `CONFIG-AND-SECRETS.md`. Injected into ECS tasks; never committed. |
| **Observability** | **CloudWatch** (+ optional Sentry) | — | Logs, metrics, and the alarms that trigger scaling and page you. |

---

## Auto-scaling configuration (the actual knobs)

**Web tier (ECS Fargate service auto-scaling):**
- Policy: **target tracking**. Two targets is usually enough — average **CPU ≈ 60%** and **ALB requests-per-target** at a level your load test proves safe.
- Min tasks: **2** (survives an AZ loss). Max tasks: **20** to start (raise after load testing).
- Scale-out cooldown short (30–60s) so you react to spikes; scale-in cooldown longer (300s) so you don't flap.

**Worker tier:** scale on **SQS queue depth** (`ApproximateNumberOfMessagesVisible` per task). Cap max concurrency to what your **provider tier** allows — this is a deliberate throttle, not a bottleneck to remove.

**Database:** does **not** auto-scale horizontally. Plan capacity from the load test; use **RDS storage auto-scaling** for disk, add **read replicas** for read growth, and scale the instance class up during a maintenance window when the load test says you're near the write ceiling.

**Cache:** size Redis so the working set (leaderboard, prize pool, sessions) fits in memory. A cache miss storm hitting Postgres is a common failure mode — set sensible TTLs and pre-warm on deploy.

---

## The three things auto-scaling does NOT fix (address these on purpose)

1. **Database write ceiling.** One primary handles all writes. Mitigate with RDS Proxy (pooling), read replicas (offload reads), and query tuning on the JSONB/GIN tables for heavy write/aggregate paths (mass payouts, analytics sweeps).
2. **Hot-read pressure.** The 15-second prize-pool poll × 100k users is a self-inflicted DDoS if it hits Postgres. It must be served from Redis.
3. **Third-party provider limits.** OpenAI/Anthropic, SendGrid, Twilio, Stripe rate limits live in *your* accounts. More containers = more pressure on them. The SQS + worker pattern turns that into a managed queue; raising provider tiers raises the drain rate.

---

## Cost sketch (order of magnitude, USD/month, at real 100k-scale usage)

- RDS Postgres (Multi-AZ `r6g.xlarge` + replica): ~$700–1,200
- ECS Fargate (web + worker, auto-scaled): ~$300–1,200
- ElastiCache (Redis, 2 nodes): ~$200–500
- ALB + CloudFront + S3 + data transfer: ~$150–500
- **Provider usage (LLM/SMS/email/payments): usage-based and often the largest line** — this scales with engagement, not infra, and is the main reason to cache and queue aggressively.
- **Infra floor at this scale: ~$1,500–3,500/mo**, plus provider usage on top. (Early launch on minimal sizing is far lower — see `BASE44-MIGRATION-PLAN.md`.)

---

## Build order for the developer

1. Containerize (Dockerfile already in `/backend`) → push to **ECR**.
2. Stand up **RDS** (Multi-AZ) + **RDS Proxy**; load `backend/db/schema.sql`.
3. Deploy the **ECS Fargate web service** behind the **ALB**; wire secrets from **Secrets Manager**.
4. Front the frontend with **CloudFront** (+ SPA fallback) and point `VITE_NEXUS_API_URL` at the ALB/domain.
5. Add **ElastiCache** and move the hot reads (prize pool, leaderboard, sessions) behind it.
6. Add **SQS** + the **worker service**; move LLM/email/SMS/payout calls onto the queue.
7. Add **read replica(s)**; route read-only queries to them.
8. Configure **auto-scaling policies** (above) and **CloudWatch alarms**.
9. **Run the load-test plan** (`LOAD-TEST-PLAN.md`) → resize from real numbers before launch.

> This is a projection from the architecture, not a measured result. Step 9 is what turns "should handle 100k" into "handles 100k."
