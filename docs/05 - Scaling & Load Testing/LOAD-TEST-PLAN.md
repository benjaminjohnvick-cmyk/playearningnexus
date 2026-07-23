# GamerGain / PlayEarning Nexus — Load-Test Plan

**Purpose:** prove the app handles the target load (path to **100,000 registered users**, ≈5,000–15,000 concurrent at peak) *before* launch, and find where it bends first so you fix that instead of guessing. Turns "should scale" into measured numbers.

_Written July 21, 2026 for the self-hosted stack (React frontend · Deno backend · PostgreSQL, deployed on AWS per `AWS-SCALING-ARCHITECTURE.md`). A developer can run this straight from here._

---

## 0. Ground rules

- **Test against a staging environment that mirrors production** (same instance classes, RDS Proxy, Redis, SQS, auto-scaling enabled) — never against live production, and never against a laptop.
- **Use test/sandbox keys** for Stripe, PayPal, Twilio, OpenAI/SendGrid so you don't spend real money or send real messages. Point payouts at provider sandboxes.
- **Seed realistic data first:** ~100k user rows, referrals, surveys, leaderboard entries, an active contest. An empty database lies — indexes and query plans behave differently at volume.
- **One variable at a time.** Change one thing (instance size, cache TTL, worker concurrency), re-run, compare.

## 1. Tooling

- **k6** (recommended) — scriptable in JS, great for API load, easy CI integration. Alternatives: **Locust** (Python) or **Artillery**.
- Run the generator from a machine/region with enough network headroom (a small EC2 fleet or k6 Cloud) so the *tester* isn't the bottleneck.
- Watch the system under test with **CloudWatch** dashboards (ECS CPU/memory, ALB latency + 5xx, RDS CPU/connections/replica lag, Redis hit rate, SQS depth) open live during every run.

## 2. What to test — the real user journeys (weighted by traffic)

Model the mix a real day looks like, not one endpoint hammered alone:

| Journey | Rough weight | Why it matters |
|---|---|---|
| **Browse / dashboard load** (auth check + prize-pool widget + leaderboard) | ~40% | Highest volume; the 15s prize-pool poll is the #1 hot-read risk. |
| **Sign-in / sign-up** (JWT issue, Google verify) | ~10% | Auth + a DB write; spikes at campaign launches. |
| **Complete a survey / earning action** (write + credit + async LLM/verify) | ~20% | Touches DB writes **and** the provider queue — the money path. |
| **Referral action** (create referral, milestone check, contest entry) | ~15% | Write-heavy + leaderboard recompute. |
| **Payout / wallet** (balance read, request payout → SQS) | ~10% | Provider-bound; must not block the web tier. |
| **Static/asset loads** | ~5% | Should be served by CloudFront, not the backend — confirm it is. |

## 3. Load profiles (run all four)

1. **Baseline / smoke** — 50–100 virtual users, 5 min. Confirms the script and environment work and gives a clean latency floor.
2. **Ramp (capacity test)** — step from 100 → target concurrency (e.g. +500 VUs every 2 min up to 10,000). **Find the knee** — the point where latency climbs or errors start. That knee is your real capacity on the current sizing.
3. **Soak (endurance)** — hold a steady realistic load (e.g. 3,000–5,000 VUs) for **2–4 hours**. Surfaces slow leaks: connection-pool exhaustion, memory growth, replica lag drift, queue backlog that never drains.
4. **Spike** — jump from low to high (e.g. 500 → 8,000 VUs in under a minute), hold, drop. Proves auto-scaling reacts fast enough and nothing falls over during the scale-out lag.

## 4. Metrics & pass/fail targets (SLOs)

Define pass/fail *before* running so results are objective:

| Metric | Target (tune to your needs) |
|---|---|
| **p95 API latency** | < 500 ms under sustained peak load |
| **p99 API latency** | < 1,500 ms |
| **Error rate (5xx + timeouts)** | < 0.5% |
| **Prize-pool / leaderboard reads** | served from Redis; **cache hit rate > 95%** |
| **RDS primary CPU** | < 70% sustained (headroom for spikes) |
| **RDS connections** | well under max via RDS Proxy; no connection errors |
| **Read-replica lag** | < 1–2 s |
| **SQS queue depth** | drains steadily; not monotonically growing during soak |
| **Auto-scaling** | web tier scales out within ~2–3 min of a spike; scales back in after |
| **Payout/earning correctness** | 100% — every credited action reconciles; no double-credit under concurrency |

## 5. Where it will bend first (predictions to verify)

Based on the architecture, watch these in order — they're the likely first failures:

1. **The prize-pool widget poll** (15s × all users). If it's hitting Postgres instead of Redis, RDS CPU spikes early. **Fix:** cache it; confirm hit rate.
2. **DB connection exhaustion.** Without RDS Proxy, containers open too many connections. **Fix:** RDS Proxy / pooling.
3. **Provider rate limits** on the earning path (LLM/email/SMS). Surfaces as queue growth or provider 429s. **Fix:** SQS worker concurrency capped to tier; raise tier.
4. **Leaderboard / referral aggregation** queries on the JSONB tables. **Fix:** targeted indexes, read replicas, cache the computed leaderboard.
5. **Write contention** on hot rows (e.g. a shared prize-pool total). **Fix:** avoid single-row hotspots; aggregate asynchronously.

## 6. Runbook (per cycle)

1. Deploy the current build to staging; enable auto-scaling; confirm dashboards.
2. Seed/refresh ~100k-scale data.
3. Run **smoke** → fix anything broken.
4. Run **ramp** → record the knee (capacity number) and the first component to saturate.
5. Fix the top bottleneck (one change).
6. Re-run **ramp** → confirm the knee moved out.
7. Once ramp meets target, run **soak**, then **spike**.
8. Record instance sizes, the capacity number, and cost at that sizing. **This is your launch capacity statement.**
9. Set CloudWatch alarms at ~70–80% of the proven limits so production warns you before it hurts.

## 7. Deliverable from the test

A one-page result: *"On [instance sizes], the app sustained **N concurrent users** at p95 **X ms** and **<0.5%** errors; first bottleneck was **[component]**, addressed by **[change]**; next ceiling is **[component]** at roughly **M** users."* That sentence — backed by graphs — is what lets you say "handles 100k" honestly.

---

> Pair this with `AWS-SCALING-ARCHITECTURE.md`. Build the architecture, then run this plan against it and resize from the real numbers before you launch.
