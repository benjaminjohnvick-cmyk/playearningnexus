# PlayEarning Nexus — Base44 → Self-Hosted AWS Migration Plan

_Created July 20, 2026. This is the architecture and phased plan for moving the backend off Base44 onto infrastructure you own, so there's no platform ceiling and you control scaling directly._

## Read this first: what moving off Base44 does and doesn't do
- **Does:** removes Base44's plan/capacity ceiling; gives you direct control of the database, scaling, and cost; no per-call middleman.
- **Does NOT:** remove rate limits. The limits that matter — LLM calls, Stripe/PayPal, Twilio SMS, BitLabs — come from **those providers**, not Base44. After migration they live in *your* accounts. You manage them with higher provider tiers and a job queue (see "Throughput"). Budget for this; it's the honest trade.

## Why this is feasible (the key insight)
All 526 functions talk to Base44 through **one consistent SDK surface**:
`createClientFromRequest`, `entities.X.{filter,create,update,list,get,delete,bulkCreate}`, `auth.me`, `integrations.Core.{InvokeLLM,SendEmail,GenerateImage}`, `functions.invoke`, and `asServiceRole`. Because it's consistent, we replace the SDK — not the 526 functions. A compatibility layer with the identical API means the functions run after a mechanical import-swap.

Usage measured in your codebase: 984 `.filter`, 575 `.create`, 545 `.update`, 201 `.list`, 44 `.get`; 245 `InvokeLLM`, 166 `SendEmail`, 3 `GenerateImage`; heavy `asServiceRole`. All covered by the shim.

## Target stack
| Base44 feature | Replaced with |
|---|---|
| Function runtime (Deno) | **Deno** container on **AWS ECS Fargate** (keeps `Deno.serve`/`Response`/`Deno.env` — no runtime rewrite) |
| Entities / database | **Amazon RDS for PostgreSQL** — one table per entity, JSONB `data` column, GIN index; `filter()` compiles to SQL |
| Auth (`base44.auth`) | **JWT** (HS256) now; **AWS Cognito** optional later — same `auth.me()` surface |
| `InvokeLLM` | **OpenAI or Anthropic** API directly (`LLM_PROVIDER` env) |
| `SendEmail` | **SendGrid** (default) or **Amazon SES** |
| `GenerateImage` | **OpenAI Images** (DALL·E) |
| `functions.invoke` | In-process dispatch (no network hop) |
| File upload | **Amazon S3** (Phase 3) |
| Static frontend | unchanged — **CloudFront/Amplify** |

Architecture: CloudFront (frontend) → ALB → ECS Fargate service (Deno backend, auto-scaled) → RDS Postgres (Multi-AZ) + ElastiCache (Phase 3 caching) + SQS (Phase 3 queue for LLM/email) + S3 (uploads).

## What Phase 1 already produced (in this package)
- ✅ **`db/schema.sql`** — 235 tables generated from your real entities (0 parse failures).
- ✅ **Compatibility SDK** (`sdk/`) — entities/auth/integrations/functions/asServiceRole, `filter()`→SQL, JWT auth, provider adapters. Passes TypeScript syntax checks.
- ✅ **All 526 functions auto-converted** (`functions/`) to import the new SDK — 526/526 converted cleanly, each had exactly one `Deno.serve`.
- ✅ **Server** (`server/main.ts`) mounting every function + auth routes.
- ✅ **Deploy config** — Dockerfile, docker-compose (Postgres + backend), `.env.example`.
- ✅ **Re-runnable tooling** — schema generator + function codemod.

## Phased plan (remaining work)

### Phase 2 — Make it actually run (est. 1–2 weeks)
- Stand up Postgres locally (`docker compose up`), load `schema.sql`, seed an admin User.
- Smoke-test a dozen representative functions end-to-end against the DB; fix any query-translation edge cases (nested `$or`, array-contains, pagination) the shim doesn't yet cover.
- Build the **frontend client shim** so `src/api/base44Client.js` calls this backend (`/functions/<name>`, `/auth/*`) with the same method names the 1,400+ frontend call sites already use.
- Wire real **auth** (JWT signup/login already stubbed; connect to the frontend login flow, or switch to Cognito).

### Phase 3 — Parity & production hardening (est. 2–4 weeks)
- **Agents (76):** Base44 runs these on its platform. Re-implement as scheduled ECS tasks / EventBridge crons calling the same functions (they already contain the logic). Map each agent's trigger + schedule.
- **Row-level security:** Base44 auto-scopes some per-user reads. Audit which entities need per-user isolation and add `created_by = currentUser` filters in the user-scoped client (service-role paths are unaffected).
- **File uploads → S3**, **SES** for email at scale, **ElastiCache** for hot reads (leaderboards, the prize-pool widget's 15s poll).
- **Throughput / rate limits:** put LLM + email calls behind **SQS + a worker** so provider rate limits become a queue depth, not user-facing errors. Set concurrency to your provider tier.
- Observability: CloudWatch logs/metrics, alarms; error tracking (Sentry).

### Phase 4 — Cut over (est. 1 week + data migration)
- **Data migration:** export existing Base44 entity data → load into Postgres (a script per entity; the JSONB shape makes this a straight map).
- Run both in parallel; shadow-read to compare; flip the frontend to the new backend; monitor; decommission Base44.

## Cost sketch (order of magnitude, USD/month)
- RDS Postgres (Multi-AZ, small–medium): ~$60–250
- ECS Fargate (2–6 tasks, auto-scaled): ~$40–300
- ALB + CloudFront + S3 + data transfer: ~$30–120
- ElastiCache (optional): ~$30–120
- **LLM usage is the big variable** — usage-based; could dwarf infra at scale. This is the real cost driver, and the main reason to queue/cache aggressively.
- Rough infra floor ~$150–800/mo depending on scale, **plus** provider (LLM/SMS/email) usage.

## Risks / honest caveats
- **Effort:** realistically 4–8 weeks of focused work to full cutover, even with the foundation done.
- **Untested against a live DB yet:** the shim compiles but Phase 2 will surface query edge cases.
- **Agents + RLS** are the least mechanical parts and need per-feature attention.
- **Ops burden:** you now run a database and a service (backups, patching, scaling, on-call) that Base44 handled for you. That's the cost of ownership.
