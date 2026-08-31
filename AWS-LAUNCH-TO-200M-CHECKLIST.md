# Launch → 200M Users — AWS Setup Checklist

*Plain-English setup guide for whoever configures the AWS account. The app code is already built for this — the
backend is stateless and the database is chosen by a connection string, so most of this is configuration, not
rewriting. Do the phases in order; you do NOT need the later phases at launch. Rule of thumb: turn on
auto-scaling for the app, run the database on Aurora, and add pieces only as real traffic demands.*

## Phase 1 — Launch (do these first)

- [ ] **App servers with auto-scaling.** Run the backend on **ECS Fargate** or **App Runner** with a
      **target-tracking auto-scaling policy** (target ~60% CPU, or a requests-per-target goal). This is the
      "adds machines automatically" behavior — set it once; it scales up and back down on its own.
- [ ] **Database on Amazon Aurora (PostgreSQL-compatible), not plain RDS.** Start with **Aurora Serverless v2**
      so capacity auto-scales with load. Point the app's `DATABASE_URL` at the Aurora **writer** endpoint.
- [ ] **HTTPS + load balancer** in front of the app (Application Load Balancer), with health checks.
- [ ] **Object storage** for media/files: an **S3 bucket** (used for recordings, images, uploads).
- [ ] **Secrets** in **AWS Secrets Manager** (DB credentials, API keys, any stream keys). Never hard-code them.
- [ ] **Backups on**: Aurora automated backups + a retention window; test a restore once.

## Phase 2 — Early growth (add when traffic climbs)

- [ ] **Read replica.** Add an Aurora **read replica** and set the app's `DATABASE_REPLICA_URL` to the
      **reader** endpoint. The code already routes reads to it automatically — no code change. Most traffic is
      reads, so this buys a lot of headroom.
- [ ] **Cache layer.** Add **Amazon ElastiCache (Redis)** in front of the hottest reads (catalog, config,
      leaderboards) and turn on the app's cache flag.
- [ ] **CDN.** Put **CloudFront** in front of the app and S3 so static assets and media are served from the edge.
- [ ] **Raise auto-scaling ceilings** (max task count) as needed and confirm scale-in still happens off-peak.

## Phase 3 — Very large scale (only when you're genuinely big)

- [ ] **Shard the database** with **Aurora DSQL / Aurora Limitless** — AWS's distributed SQL that scales writes
      horizontally **without an app rewrite** (it's Postgres-compatible; the app keeps working).
- [ ] **Offload heavy event/log data** out of the transactional DB (partitioned tables or a separate store) so
      the core stays lean.
- [ ] **Multi-AZ everywhere** (and consider multi-region) for availability.

## Ongoing

- [ ] **Monitoring & alerts**: CloudWatch dashboards + alarms on CPU, DB connections, error rate, latency.
- [ ] **Cost guardrails**: AWS Budgets + alerts; review the auto-scaling min/max monthly.
- [ ] **Load test** before big launches to confirm scale-up triggers fire in time.

## Do NOT do these (they cost more effort and add risk, not scale)

- Don't run the production database on **stitched-together free hosting tiers** — no SLA, tiny caps, and it's
  more work than one Aurora, not less.
- Don't try to host the **authoritative database on users' devices** — user devices can't be the source of truth
  for money/inventory (trust, availability, and privacy all break).
- Don't put **money, balances, or identity** logic on the client — those stay server-side by design.

*The app is scale-ready; reaching 200M is this staged infrastructure-and-spend path, not a single switch. Fuller
rationale is in `AWS-200M-PATH.md` and `DB-SCALING-PATH.md`.*
