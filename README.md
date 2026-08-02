# GamerGain / PlayEarning Nexus

> **Posture: everything is ON, up, and running from the get-go** — the product ships feature-complete with every flag ON by default and pre-warms its own content, so launch is deploy/test/submit, not build. See `EVERYTHING-ON-FROM-DAY-ONE.md`.

A play-to-earn platform (surveys, games, referrals, rewards). **Self-hosted** — this app no longer
uses Base44; it runs on its own React frontend + a Deno backend + PostgreSQL.

## 🚀 One-click deploy (no terminal)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new?template=https://github.com/benjaminjohnvick-cmyk/playearningnexus)

Click the button, sign in to Railway, and it imports this repo. Then, in the new project:
**(1)** add a **PostgreSQL** database (Railway → *+ New* → *Database* → *PostgreSQL*),
**(2)** on the backend service set **Root Directory = `backend`** (it auto-reads `backend/railway.json`), and
**(3)** paste your keys as service **Variables** — the easiest way to get them is the **setup wizard**:
open `deploy-kit/wizard/index.html` (double-click the file), fill in the blanks, and it generates your
env for copy-paste. Full walkthrough (and the automatic push-to-deploy pipeline): see
**`deploy-kit/CONTINUOUS-DEPLOYMENT-AND-ONE-CLICK.md`**.

Everything ships **on by default** — no feature-enablement steps. The only switches that stay off are the
legally-gated ones (card charging, cash-out, etc.), which you enable later once their prerequisites are met.

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
