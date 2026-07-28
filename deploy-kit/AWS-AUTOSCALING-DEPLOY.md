# AWS Paid Tier + Auto-Scaling — Deploy Guide

Run GamerGain on AWS with real auto-scaling and managed reliability. This uses the app's **prebuilt
scale toggles** (Redis / read-replica / SQS), so scaling up is env flips, not code changes. Not
financial advice; AWS prices change — confirm current pricing and use the AWS Pricing Calculator.

## Architecture (recommended)
```
                 ┌──────────────┐
  users ───────▶ │  CloudFront   │ (CDN, TLS)        S3 (images) ◀── Bedrock (image gen)
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐    Application Auto Scaling (target-tracking)
                 │     ALB       │◀───────────────────────────────┐
                 └──────┬───────┘                                  │
                        ▼                                          │
                 ┌──────────────┐   scales 1..N tasks on CPU / req-count
                 │ ECS Fargate  │────────────────────────────────┘
                 │ (Deno app,   │
                 │  single svc) │──▶ RDS Postgres (primary) + read replica
                 └──────┬───────┘──▶ ElastiCache (Redis)
                        └──────────▶ SQS (worker fleet for LLM/email/payouts)
```

## Components
- **Compute — ECS Fargate** behind an **Application Load Balancer**, with **Application Auto Scaling**
  (target-tracking policy, e.g. keep average CPU ~60% or ALB `RequestCountPerTarget` at a target).
  Min 1–2 tasks, max as needed. (Simpler alternative: **AWS App Runner** auto-scales with less setup but
  less control — good if you want fewer moving parts.)
- **Database — Amazon RDS for PostgreSQL** (start `db.t4g.small`), or **Aurora Serverless v2** if you
  want the DB itself to auto-scale capacity. Add a **read replica** and set `DATABASE_REPLICA_URL` to
  turn on the app's read-routing.
- **Cache — ElastiCache (Redis)**; set `REDIS_URL` to enable the shared cache toggle.
- **Workers — SQS**; set `QUEUE_DRIVER=sqs` + `SQS_QUEUE_URL` so slow jobs (LLM, email, payouts) fan out
  to a separate autoscaled worker service instead of running in-process.
- **Images — Bedrock** (already AWS): `IMAGE_PROVIDER=aws_bedrock` (see `SERVERLESS-GPU-SETUP.md`).
- **Static/media — S3** (+ CloudFront) for generated images; set `S3_BUCKET` / `S3_PUBLIC_BASE`.
- **Secrets — AWS Secrets Manager / SSM Parameter Store** for `.env` values.

## Env (paste into the ECS task definition / Secrets Manager)
```
PORT=8000
AUTO_MIGRATE=1                 # schema loads on boot
SCHEDULER_INLINE=0             # run the scheduler as its own small task/cron once you scale out
FRONTEND_DIR=../dist           # single service serves SPA + API (or serve dist/ from S3+CloudFront)
DATABASE_URL=postgres://...    # RDS primary (Secrets Manager)
DATABASE_REPLICA_URL=postgres://...   # RDS read replica (turns on read routing)
REDIS_URL=redis://...          # ElastiCache (turns on shared cache)
QUEUE_DRIVER=sqs               # turns on the worker fleet
SQS_QUEUE_URL=https://sqs...
AI_DAILY_SPEND_CAP_USD=25      # cap LLM spend even with autoscaling on
IMAGE_PROVIDER=aws_bedrock
AWS_REGION=us-east-1
# AWS creds via the task's IAM role (preferred over static keys)
```

## Auto-scaling policy (starting point)
- Service min tasks: **2** (HA across AZs), max: **10** (tune to budget).
- Target tracking: **ECSServiceAverageCPUUtilization = 60%**, or ALB `RequestCountPerTarget` ≈ your
  measured per-task capacity from the load test (`LOAD-TEST-PLAN.md`).
- Scale-in cooldown 300s, scale-out 60s. Run the load test first so the target is data-driven.

## Cost (honest, launch-scale estimate — confirm on the AWS calculator)
| Component | ~Monthly at low traffic |
|---|---:|
| ECS Fargate (1–2 small tasks) | $15–40 |
| ALB | $16–22 |
| RDS Postgres (t4g.small + storage) | $25–40 (Aurora Serverless v2: ~$45+) |
| ElastiCache (cache.t4g.micro) | $12–18 |
| SQS + data transfer + CloudWatch | $5–15 |
| S3 + CloudFront | $1–10 |
| **Floor (before traffic)** | **≈ $75–145/mo** |
| Bedrock images (one-time) | ~$10–15 |

So the AWS paid + auto-scaling floor is roughly **$75–145/mo (~$900–1,740/yr)** before traffic, and it
**scales up with usage** — that's the point of auto-scaling. This is a deliberate trade for reliability
and scale; it puts year-one all-in **above the ~$3,000 shoestring target** (see `LAUNCH-ESTIMATE`). To
keep it lean early: min 1 task, App Runner instead of ECS+ALB, RDS single-AZ, and leave Redis/SQS
**off** (they're toggles) until the load test says you need them — that trims the floor toward ~$40–70/mo.

## Deploy steps (once)
1. Build + push the app image to **ECR**.
2. Create **RDS** (Postgres) + note the connection string in Secrets Manager.
3. Create the **ECS cluster + Fargate service + ALB**, attach the task role (Bedrock/S3/SQS perms).
4. Add **Application Auto Scaling** target-tracking policy.
5. (Optional, when needed) ElastiCache + read replica + SQS → set the three env toggles.
6. Point **CloudFront/Route 53** at the ALB; run `deploy-kit/e2e-smoke.mjs` against the live URL.
