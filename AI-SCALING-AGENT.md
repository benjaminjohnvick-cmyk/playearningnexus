# The AI scaling agent + one-switch scaling — how it actually works (and what it deliberately does NOT do)

Goal: **when the site needs more scale, it scales — ideally you just flip one switch.** This document explains
how that is built, and is honest about the one thing that sounds appealing but is a trap: an AI that *rewrites
your production code* to scale.

## The key idea: you scale by running the SAME code on more machines, not by rewriting code

Well-architected web apps scale **horizontally**: the app is **stateless** (no per-server memory of users;
sessions/state live in the DB, cache, queue, and object storage), so a load balancer can run **N identical
copies** and a cloud **auto-scaler** adds or removes copies based on live load — CPU, request rate, queue depth.
The code never changes; the *number of machines* changes. This is how AWS, Railway, and Kubernetes all scale.

So the right mental model is: **scaling = infrastructure + configuration, not code modification.**

## Why we did NOT build an "AI that alters the code when more scale is needed"

An AI that autonomously edits production code in response to load is an anti-pattern and a real hazard:
- **Unpredictable + unauditable:** every load spike could silently change your running code; you'd never know
  what's deployed. Rollback and incident response become impossible.
- **Security:** an automated writer with commit/deploy access to production is one prompt-injection or bug away
  from shipping a vulnerability or an outage — under load, exactly when you can least afford it.
- **It doesn't even solve the problem:** the bottleneck at scale is *capacity* (more CPU/instances/GPUs), which
  code edits can't add. You need more machines, not different code.

So we build the two halves that actually deliver "it just scales," and keep the AI **advisory**, not autonomous.

## Half 1 — configuration auto-scaling (live, built): the scale governor

`sdk/scale-governor.ts` + `scaleGovernorRun` watch live metrics and automatically flip **config levers** to
their scaled option as load crosses thresholds (and back down with hysteresis): video render → **serverless
GPU**, shared **cache** on, reads → **DB replica**, higher **render/worker concurrency**, scaled **AI tier**.
This is the mirror of `costFloorProfile` (cheapest by default; scaled only when demand pays for it). `AUTO_SCALE_
ENABLED` gates it; preview-only until on. All of these point at **real services** the moment their credentials
are set: `DATABASE_REPLICA_URL` (replica), `REDIS_URL` (cache), `SERVERLESS_GPU_ENDPOINT` + `ABACUS_API_KEY`
(render). The render path is a real, guarded API call (`sdk/video-render.ts` → `renderVideoCall`).

## Half 2 — infrastructure auto-scaling (the "one switch"): your cloud host adds machines

The app tier scales by the **cloud auto-scaler** running more copies of the stateless app. Pick one:
- **AWS (the "turn on auto-scaling" path):** deploy the app on **ECS Fargate** or **App Runner** with
  **target-tracking auto-scaling** (e.g. keep CPU ~60% or requests/target in range). AWS adds/removes tasks
  automatically. The DB is **RDS/Aurora** with read replicas; cache is **ElastiCache**; media/renders go to the
  serverless GPU endpoint; assets to **S3 + CloudFront**. See `AWS-SCALING-ARCHITECTURE.md` and
  `SCALE-TO-AMAZON-STRATEGY.md`. Once configured, "turn on AWS auto-scaling" is literally the one switch — the
  scale governor handles the config side underneath.
- **If AWS isn't wired yet — Railway (where you are now):** enable **horizontal replicas + autoscaling** on the
  service and use a Railway/managed **Postgres replica** and **Redis**. Same effect, less setup. This is the
  fastest "one switch" today.
- **If you outgrow both — Kubernetes** with a **Horizontal Pod Autoscaler** (HPA) on CPU/RPS, managed DB + cache.
  Most control, most ops.

**Prerequisite for all three: the app must stay stateless.** See `SCALE-READINESS.md` — no per-instance memory,
all state in Postgres/Redis/object storage, health checks for the load balancer. That's what makes "add
machines" safe, and it's already the design.

## The AI scaling agent — advisory, the safe role (built): `scaleAdvisor`

`scaleAdvisor` is the Claude-friendly "scaling agent" done right. Given live metrics it returns (a) the **config
changes the governor will auto-apply**, and (b) **infra recommendations for you / the auto-scaler** ("ensure
Fargate target-tracking is on", "confirm the read replica", "raise GPU concurrency"). It is **read-only and
advisory** — it never edits code and never provisions servers. If you want Claude more in the loop later, the
safe pattern is: the agent **opens a pull request** with an infra/config change for **human review + CI**, never
a direct write to production. Autonomy for money/identity/legal and for **production code** stays a permanent
human gate (same posture as the Autonomy Kernel).

## What you actually do to scale

1. Keep the app stateless (done — `SCALE-READINESS.md`).
2. Wire the real services: set `DATABASE_REPLICA_URL`, `REDIS_URL`, `SERVERLESS_GPU_ENDPOINT`/`ABACUS_API_KEY`.
3. Turn on your host's auto-scaler (Railway replicas now, or AWS Fargate/App Runner target-tracking).
4. Flip `AUTO_SCALE_ENABLED` on — the governor then switches the config levers automatically with load, and
   `scaleAdvisor` tells you if any infra action is warranted.

That is the honest version of "all I have to do is turn on auto-scaling": the code is scale-ready, the config
scales itself, and the machines scale via the cloud auto-scaler — no AI rewriting your code.

## "Does this work for 200,000,000 users?" — the honest answer

**No single piece of code makes a system handle 200M users** — and anyone who tells you otherwise is selling
something. 200M users (top-tier-consumer-app scale) is the product of **architecture + infrastructure + a real
engineering/SRE team + serious money + staged load testing over time.** What code *can* do is make the system
**scale-ready** — remove every *code-level* ceiling so that capacity is purely a matter of provisioning. That is
what's built here. The remaining ceilings at extreme scale are infrastructure and organizational, and they are
mapped below honestly so there are no surprises.

**What's code-ready now (no code changes needed to scale):**
- **Stateless app** (`SCALE-READINESS.md`) → horizontal scaling works.
- **Instance auto-scaling** (`infraScaleController`) → adds/removes machines via your cloud API, capped.
- **Config auto-scaling** (scale governor) → cache, replica routing, concurrency, serverless render flip with load.
- **Idempotent money ops + caps** → safe under concurrency and retries.
- **Serverless render + AI on elastic providers** → those tiers scale independently.

**The real ceilings that appear as you grow, and what each actually needs (not code — infra + eng):**
1. **App tier** — solved: horizontal auto-scaling (above). This is the easy one.
2. **Database — the #1 bottleneck at scale.** A single Postgres does NOT serve 200M users. The staged fix:
   **connection pooling (PgBouncer)** → **read replicas** (the governor already routes reads to
   `DATABASE_REPLICA_URL`) → **table partitioning** of the hot/append tables → **sharding** or a **distributed
   SQL** engine (Aurora, CockroachDB, Spanner, Citus). This is dedicated database engineering, done in stages as
   you grow — not a flag.
3. **Cache + assets** — a **Redis/ElastiCache cluster** and a **CDN** (CloudFront) for all static/media so the
   origin isn't hit 200M times.
4. **Async/throughput** — **partitioned queues** (SQS/Kafka) with workers that scale via the infra controller.
5. **Multi-region** — for latency and availability at that population; real, non-trivial infra work.
6. **Cost/economics** — at 200M users the monthly infra + AI + render bill is very large; the cost-floor helps,
   but the **revenue model has to fund it**. This is a business gate as much as a technical one.
7. **Observability + SRE + load testing** — metrics/tracing/alerting, rate limiting, and repeated load tests at
   each stage. At this scale you need **people**, not just code.

**Bottom line:** the platform is built in the **correct shape to scale** and the scaling **controllers are
real**, so it is **200M-*ready* at the code/architecture level** — nothing in the code blocks it. But reaching
200M *actual* users is a **staged infrastructure, cost, and engineering journey** (especially the database
path), not a switch. Do it in stages, load-test each one, and bring in infra/SRE help as you cross into the
millions. The honest sequence: prove product-market fit and the unit economics first; the technology will scale
when the demand and the funding to provision it are real.

## Automatic on-device fallback (resilient mode)

When the server is under pressure or unreachable, the app **automatically shifts to running from the device** so
a spike/outage becomes "works read-only from your phone" instead of "site down" — buying the auto-scaler time.

- **Signal:** `systemLoadSignal` reports `normal | degraded | overloaded` (cheap, one indexed read). The client
  polls it every ~15s and also reacts to browser online/offline events.
- **Client (`src/lib/resilient-mode.js` + a PWA service worker):** on `degraded`/`overloaded`/offline it serves
  **reads/UI/AI from a local cache** and, when overloaded, **queues non-sensitive writes** with a client
  idempotency key, flushing them (exactly once) when state returns to `normal`.
- **HARD LIMIT — the trust boundary holds even in fallback:** **sensitive actions (payout, purchase, balance
  change, KYC — anything money/identity/legal) are NEVER run or queued on-device.** They require the online,
  server-authoritative path + step-up, and are blocked with "try again in a moment" during fallback. Stale local
  state that the user controls can never move real value. This is the same "device proposes, server disposes"
  rule as everywhere else — resilient mode degrades the *experience*, never the *authority*.
- Gated OFF (`RESILIENT_MODE_ENABLED`); thresholds `RESILIENT_DEGRADE_RPM` / `RESILIENT_OVERLOAD_RPM`;
  `RESILIENT_FORCE_STATE` to drill it. Wire `initResilientMode(base44)` at app start + add a PWA service worker
  to cache the app shell for true offline.
