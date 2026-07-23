# Phase 3 — Parity & production hardening (build notes)

This phase adds the pieces that Base44 provided beyond plain functions: the AI agents, row-level security, file storage, production email, and rate-limit absorption. Everything here is in the package; this doc is how to turn each on.

## 1. Row-Level Security (RLS) — DONE, verify it
- `tools/rls-audit.mjs` scanned your entities + functions and produced **`db/rls-policy.json`**: **134 user-scoped** entities, **101 global**.
- The frontend entity routes (`server/entity-routes.ts`) now enforce it: a signed-in user only sees/edits their own rows on scoped entities; global entities stay open; backend functions (service role) bypass RLS as before.
- **Action:** skim `db/rls-policy.json`. If any entity is mis-classified (e.g. something marked `global` that should be per-user, or vice-versa), fix the entry — `{ "scope": "owner", "owner_field": "user_id" }` or `{ "scope": "global" }`. Re-run the audit anytime: `node tools/rls-audit.mjs <repo> db/rls-policy.json`.

## 2. AI Agents (76) — runtime included
- `tools/gen-agents.mjs` converted all 76 agent definitions into **`agents-runtime/agents.json`** (912 entity tool-bindings).
- `agents-runtime/agent-runtime.ts` runs each agent as an OpenAI function-calling loop, exposing exactly the entities/operations each agent is allowed (read/create/update). Its data access is capped to its `tool_configs`.
- **Endpoints:** `GET /agents` lists them; `POST /agents/<name> { message, context? }` runs one.
- **Needs:** `OPENAI_API_KEY`. Optional: `AGENT_MODEL`, `AGENT_MAX_STEPS` (default 6).
- **Note:** Base44 agents also had chat channels (WhatsApp/Telegram) and long-term memory. The core reasoning + tool use is reproduced; channel webhooks and persistent agent memory are follow-ons if you use them.

## 3. Scheduler (cron automation) — included
- `scheduler/schedules.json` maps your 14 automation functions to cron times (UTC), mirroring Master Launch Guide Phase 7.
- `scheduler/main.ts` uses **`Deno.cron`** to fire each on schedule, calling the backend with a service token.
- **Run it** as a separate always-on process: `deno run --allow-net --allow-env --unstable-cron scheduler/main.ts` (set `BACKEND_URL` + `SCHEDULER_SERVICE_USER_ID`).
- **AWS options:** deploy the scheduler as its own small ECS service, **or** drop it and use **EventBridge Scheduler** rules (one per job) that POST to `/functions/<name>` — `schedules.json` is the source list either way.

## 4. File uploads → S3 — included
- `sdk/aws/s3.ts` + `sdk/aws/sigv4.ts` generate **presigned PUT** URLs (no bytes through the backend). `POST /integrations/UploadFile { filename }` → `{ upload_url, file_url }`.
- **Frontend change:** where code did `UploadFile(file)` expecting a URL back, switch to: call `UploadFile({ filename })`, then `fetch(upload_url, { method: 'PUT', body: file })`, then use `file_url`. (The 35 frontend `UploadFile` sites need this small change; grep for them.)
- **Needs:** `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or an instance role). Set bucket CORS to allow PUT from your domain.

## 5. Email at scale → SES — included
- `sdk/aws/ses.ts` sends via SES v2 (SigV4). Enable with `EMAIL_PROVIDER=ses` + AWS creds + a verified `EMAIL_FROM`. SendGrid remains the default.

## 6. Rate-limit / throughput absorption — included
- `sdk/queue.ts` wraps `InvokeLLM` and `SendEmail` in a concurrency limiter with exponential backoff on 429/5xx. Tune `LLM_CONCURRENCY` (default 4) and `EMAIL_CONCURRENCY` (default 8) to your provider tier.
- This is **in-process** — perfect for a single service. For multi-instance scale, replace `limited()` with **SQS + a worker** (same call sites); this is the one remaining infra piece for very high volume.

## New env vars (add to .env)
```
# AWS (S3 + SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_PUBLIC_BASE=            # optional, e.g. a CloudFront domain in front of the bucket
# Agents / scheduler
AGENT_MODEL=gpt-4o
BACKEND_URL=http://localhost:8000
SCHEDULER_SERVICE_USER_ID=00000000-0000-0000-0000-000000000001
# Throughput
LLM_CONCURRENCY=4
EMAIL_CONCURRENCY=8
```

## What remains (Phase 4)
- **Data migration** from Base44 → Postgres (export each entity's rows → insert; the JSONB shape is a direct map).
- **Cutover:** run parallel, shadow-compare, flip the frontend, monitor, decommission Base44.
- **Agent memory + chat channels**, **SQS** for very high volume, and **observability** (CloudWatch/Sentry) as needed.
