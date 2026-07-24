# Railway Deploy Runbook — all-in-one (backend + Postgres + scheduler + frontend)

**Goal:** everything on Railway in one project, following exact steps so there's no guesswork.
Target time for a developer: **~6–8 hours** for backend+DB+scheduler+frontend combined (vs 14–22h
of figuring it out). Owner creates the accounts/keys first (see `API-KEYS-WORKSHEET.md`).

> Stack: Railway hosts 4 things in one project — a **Postgres** database, the **Deno backend** (web),
> a **scheduler** worker, and the **static frontend**. You can host the frontend on Netlify's free
> tier instead (even simpler) — that alternative is noted at the end.

---

## 0. Before you start
- A **Railway** account (railway.app) with a paid plan or trial credit (the Hobby plan is enough to launch).
- The repo pushed to GitHub (it is: `github.com/benjaminjohnvick-cmyk/playearningnexus`).
- The filled-in `API-KEYS-WORKSHEET.md`.
- Run `bash deploy-kit/validate.sh` locally first — it proves the build is green before you deploy.

---

## 1. Create the project + Postgres
1. Railway → **New Project** → **Deploy PostgreSQL**. This creates a `Postgres` service.
2. Open the Postgres service → **Variables** → copy the **`DATABASE_URL`** (you'll paste it into the backend).
3. **Load the schema (one time).** Postgres services on Railway do NOT auto-run init scripts, so load it manually:
   - Easiest: Railway Postgres service → **Data** tab → **Query** → paste the contents of
     `backend/db/schema.sql` → Run. (Optionally run `backend/db/seed.sql` too.)
   - Or from your machine: `psql "<DATABASE_URL>" -f backend/db/schema.sql`.

## 2. Deploy the backend (web service)
1. In the same project → **New** → **GitHub Repo** → pick `playearningnexus`.
2. In the new service → **Settings**:
   - **Root Directory:** `backend`
   - **Build:** it will detect `backend/Dockerfile` automatically (Deno 2.1.4). No change needed.
   - (Optional) copy `deploy-kit/railway/backend.railway.json` to `backend/railway.json` for the
     healthcheck + restart policy baked in.
3. **Variables:** paste every backend secret from `API-KEYS-WORKSHEET.md` — at minimum
   `DATABASE_URL` (from step 1), `AUTH_JWT_SECRET`, `OPENAI_API_KEY`, `SENDGRID_API_KEY`,
   `EMAIL_FROM`, `APP_URL`, `FRONTEND_URL`, `CORS_ORIGIN`, plus your payment/survey/SMS keys.
   - **Do NOT set `PORT`** — Railway sets it, and `server/main.ts` already reads it.
4. Deploy. When it's live, open **Settings → Networking → Generate Domain**. That public URL
   (e.g. `https://nexus-backend-production.up.railway.app`) is your **backend URL**.
5. Verify: visit `https://<backend-url>/health` — it should return OK.

## 3. Deploy the scheduler (worker service)
The cron automations run in a **separate** process from the web server.
1. Project → **New** → **GitHub Repo** → same `playearningnexus` repo again (a second service).
2. **Settings:**
   - **Root Directory:** `backend`
   - **Custom Start Command:**
     `deno run --allow-net --allow-env --unstable-cron scheduler/main.ts`
   - **Networking:** no public domain needed (it's a background worker).
3. **Variables:** give it the same `DATABASE_URL` and the same API keys as the backend (it invokes the
   same functions). Tip: Railway lets you reference shared variables so you set them once.
4. Deploy. Logs should show the cron jobs registering (18 scheduled jobs from `schedules.json` +
   `agent-schedules.json`).

## 4. Deploy the frontend (static PWA)
**Option A — Railway (all-in-one):**
1. Project → **New** → **GitHub Repo** → same repo (third app service).
2. **Settings → Root Directory:** repo root (leave blank).
3. Copy `deploy-kit/railway/frontend.Dockerfile` to the **repo root as `Dockerfile`**, OR set the
   service's Dockerfile path to `deploy-kit/railway/frontend.Dockerfile`.
4. **Variables:** set `VITE_NEXUS_API_URL` = your backend URL from step 2.4 (and any other `VITE_*`
   public keys). These are read at build time.
5. Deploy → **Generate Domain**. That's your app's public URL.

**Option B — Netlify (free, even simpler for static):**
1. netlify.com → **Add new site → Import from GitHub** → `playearningnexus`.
2. Build command `npm run build`, publish directory `dist`.
3. Add a `_redirects` file containing `/*  /index.html  200` (SPA fallback) — or Netlify auto-detects Vite.
4. Set `VITE_NEXUS_API_URL` in Netlify env vars. Deploy.

## 5. Wire the two sides together
- Set the backend's `CORS_ORIGIN` and `FRONTEND_URL`/`APP_URL` to the **frontend domain**.
- Set the frontend's `VITE_NEXUS_API_URL` to the **backend domain**.
- Redeploy whichever you changed. Load the app, sign up, and confirm it talks to the backend.

## 6. Custom domain + HTTPS (optional but recommended)
- Railway (or Netlify) → the frontend service → **Settings → Domains** → add your domain and follow the
  DNS records. HTTPS is automatic. Point `VITE_NEXUS_API_URL` at a backend subdomain (e.g. `api.yourdomain.com`).

---

## Done-when checklist
- [ ] `/health` green on the backend domain
- [ ] Schema loaded (a table query returns columns, not an error)
- [ ] Scheduler logs show cron jobs registered
- [ ] Frontend loads on its domain and can sign up / log in against the backend
- [ ] `CORS_ORIGIN` = frontend domain; `VITE_NEXUS_API_URL` = backend domain

## Cost note (Railway, launch traffic)
Hobby plan ~$5/mo base + usage; Postgres + backend + scheduler + frontend at low traffic typically
lands around **$10–30/mo** total to start. Scale up instances only when the load test says so.
