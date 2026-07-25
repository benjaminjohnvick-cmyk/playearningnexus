# Nexus Backend — self-hosted replacement for Base44

This is the **Phase-1 foundation** that lets PlayEarning Nexus run on your own AWS infrastructure instead of Base44. It reimplements the Base44 SDK surface your 526 functions use, so the functions move over with a mechanical import-swap rather than a rewrite.

## What's here
```
nexus-backend/
  sdk/                 # Base44-compatible SDK (the drop-in replacement)
    mod.ts             #   createClientFromRequest / createClient, entities, auth, integrations, functions, asServiceRole
    db.ts              #   Postgres layer + filter()->SQL translation over JSONB
    integrations.ts    #   InvokeLLM (OpenAI/Anthropic), SendEmail (SendGrid/SES), GenerateImage
    auth.ts            #   JWT sign/verify (replaces base44.auth)
    runtime.ts         #   __handler helper for converted functions
  db/schema.sql        # 235 tables generated from your entities
  functions/           # all 526 functions, auto-converted to use the new SDK (+ _manifest.json)
  server/main.ts       # Deno server: mounts every function as /functions/<name>, plus /auth/*
  server/auth-routes.ts# signup / login / me
  tools/               # gen-schema.mjs, codemod-functions.mjs (re-runnable)
  Dockerfile, docker-compose.yml, .env.example
```

## Run it locally (5 minutes)
```bash
cp .env.example .env          # fill in OPENAI_API_KEY, AUTH_JWT_SECRET, etc.
docker compose up --build     # starts Postgres (loads schema.sql) + the backend
# backend on http://localhost:8000  — check http://localhost:8000/health
```

## Point the frontend at it
In the React app, the frontend Base44 SDK is created in `src/api/base44Client.js`. Replace it with a thin client that calls this backend (`POST /functions/<name>`, `POST /auth/login`, etc.). A matching frontend shim is Phase 2 — see `MIGRATION-PLAN.md`.

## Re-running the tooling
If you change entities or functions, regenerate:
```bash
node tools/gen-schema.mjs <repo>/base44/entities db/schema.sql
node tools/codemod-functions.mjs <repo>/base44/functions functions
```

## Important
- **This is a foundation, not a finished migration.** It compiles and the conversion is mechanical-complete, but it has **not** been run against a live database yet. See `MIGRATION-PLAN.md` for exactly what remains (agents, row-level security, SES, load/queue, testing) and the phase plan.
- **Rate limits move to you, they don't disappear.** The LLM/email/SMS limits now live in your own provider accounts.
