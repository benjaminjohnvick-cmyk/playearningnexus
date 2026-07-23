# GamerGain / PlayEarning Nexus

A play-to-earn platform (surveys, games, referrals, rewards). **Self-hosted** — this app no longer
uses Base44; it runs on its own React frontend + a Deno backend + PostgreSQL.

## Architecture
- **Frontend:** React + Vite PWA (208 pages). Talks to the backend over HTTP via `src/api/base44Client.js`.
- **Backend:** self-hosted **Deno** service in `/backend` — 526 HTTP function routes, 239 Postgres
  tables, JWT + Google auth, an agent runtime, and a cron scheduler. Docker + docker-compose included.
- **Database:** PostgreSQL (schema in `backend/db/schema.sql`).
- **Native apps:** Capacitor wrapper for Android + iOS (wrapper-only; regenerated, not committed).

## Run it locally
**Backend + database:**
```
cd backend
cp .env.example .env        # set DATABASE_URL, AUTH_JWT_SECRET, OPENAI_API_KEY, etc.
docker compose up --build   # starts Postgres (loads schema.sql) + the backend on :8000
```
Health check: http://localhost:8000/health

**Frontend:**
```
cp .env.example .env.local  # set VITE_NEXUS_API_URL=http://localhost:8000
npm install
npm run dev
```

## Configuration
- Backend secrets → `backend/.env` (see `CONFIG-AND-SECRETS.md` and `backend/.env.example`).
- Frontend public config → `.env.local` (`VITE_NEXUS_API_URL` is the main one).

## Where to go next
- **Get it running & tested:** `backend/PHASE-2-RUNBOOK.md`
- **Full launch sequence:** `MASTER-LAUNCH-GUIDE.md`
- **Hand to a developer:** `DEVELOPER-HANDOFF-BRIEF.md`
- **Native apps:** `MOBILE-APP-WRAPPER-GUIDE.md` + `APP-STORE-SUBMISSION-CHECKLIST.md`
- **How the Base44 removal was done (reference):** `DE-BASE44-REWORK.md`, `BASE44-TO-SELFHOSTED-MAP.md`

## Deploy (production)
Build the frontend (`npm run build` → static `dist/`) and host it (Amplify/CloudFront/etc.). Deploy
the Deno backend as a container (Render/Railway/Fly.io/AWS) with a managed Postgres, and set the SPA
history fallback (`404/403 → /index.html`). Details in `MASTER-LAUNCH-GUIDE.md`.
