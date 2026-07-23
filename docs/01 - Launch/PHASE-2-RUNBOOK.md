# Phase 2 Runbook — Make the Nexus backend actually run

Goal: stand up the self-hosted backend against a real Postgres, prove functions work end-to-end, and repoint the React frontend at it. Everything here runs on **your** machine (this couldn't be executed in the cloud sandbox — no live Postgres there).

Prerequisites: **Docker Desktop** and **Deno** (`curl -fsSL https://deno.land/install.sh | sh`). Node.js only if you re-run the tooling.

---

## Step 1 — Configure environment
```bash
cd nexus-backend
cp .env.example .env
```
Edit `.env` and set at minimum:
- `AUTH_JWT_SECRET` — any long random string.
- `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic`) — only if you want to test `InvokeLLM`.
- Leave `DATABASE_URL` as-is for the docker-compose Postgres.

## Step 2 — Start Postgres + backend
```bash
docker compose up --build
```
This starts Postgres (auto-loading `db/schema.sql` = 235 tables) and the Deno backend on `http://localhost:8000`. Wait for `Nexus backend listening on :8000`.

Check it: open `http://localhost:8000/health` → `{"ok":true,"functions":526}`.

## Step 3 — Load seed data
In a second terminal:
```bash
docker compose exec -T db psql -U nexus -d nexus < db/seed.sql
```
This creates an admin (`admin@nexus.local` / `admin1234`), a sample user, `GlobalSettings`, and a sample A/B test.

## Step 4 — Run the smoke test
```bash
deno run --allow-net --allow-env tools/smoke-test.ts
```
Expected: health, admin login, `auth/me`, entity filter, create+read roundtrip, and an `abTestAssigner` invoke all pass (the LLM check self-skips if no key is set). Any failure prints the reason — that's your Phase-2 punch list.

## Step 5 — Exercise more functions
Pick 10–15 representative functions (payments, referrals, surveys, the prize pool) and call each:
```bash
curl -s -X POST http://localhost:8000/functions/<name> \
  -H "authorization: Bearer <token-from-login>" \
  -H "content-type: application/json" -d '{ ... }' | jq
```
Watch the backend logs. The most likely edge cases to fix in the SDK's query translator (`sdk/db.ts`):
- **`$or` / nested boolean** filters (not yet supported — add if any function uses them).
- **array-contains** queries (e.g. filtering where a JSON array includes a value).
- **pagination** beyond simple `limit` (add `offset`/cursor if needed).
- Sorting on nested JSON fields.
Fix these centrally in `sdk/db.ts` — every function benefits at once.

## Step 6 — Repoint the frontend
1. In the React repo, **back up** `src/api/base44Client.js`.
2. Copy `frontend-shim/base44Client.js` over it.
3. Add to the frontend env (`.env.local`): `VITE_NEXUS_API_URL=http://localhost:8000` (later: your API domain).
4. Wire the login/signup screens to `base44.auth.login(email, password)` / `base44.auth.signup(...)` (Base44 previously hosted these; now they issue your JWT).
5. `npm run dev` and click through: sign in, load a page that lists entities, complete a survey, trigger a function. Fix mismatches as they surface.

## Step 6b — Manual auth verification (the two happy-path checks the smoke test can't do)
The smoke test proves the auth endpoints exist and reject bad input, but two flows need a real
click-through because their secrets live outside the API: the **emailed reset link** and a **real
Google token**. Do these once.

### A. Password reset end-to-end (via Mailhog)
The reset token is emailed and only its hash is stored, so you can't get it from the API or DB —
you capture it from the email. `docker compose up` already starts **Mailhog** (a local mail catcher).
1. In `backend/.env` set the email provider to SMTP → Mailhog:
   ```
   EMAIL_PROVIDER=smtp
   SMTP_HOST=mailhog
   SMTP_PORT=1025
   FRONTEND_URL=http://localhost:5173
   ```
   Restart the backend (`docker compose up -d --build backend`).
2. In the app, go to **/forgot-password**, enter `smoke-user@nexus.local` (or any user's email), submit.
3. Open the Mailhog UI at **http://localhost:8025** — you'll see the reset email. Click the link
   (or copy it); it opens **/reset-password?token=…&email=…**.
4. Enter a new password, submit. Expect success + auto sign-in. Confirm you can now log in with the new password.
> Even simpler (no Mailhog): set `DEV_RETURN_RESET_LINK=true` in `.env` (dev only) and the
> `/auth/request-reset` response returns the link directly as `dev_reset_link`. Remove this in production.

### B. Sign in with Google (real token)
The negative tests can't exercise a real Google login — you need a browser token.
1. Create an OAuth **Web** client in Google Cloud Console. Add `http://localhost:5173` to
   Authorized JavaScript origins. Copy the client id.
2. Set it in **both** envs: `VITE_GOOGLE_CLIENT_ID=<id>` (frontend `.env.local`) and
   `GOOGLE_CLIENT_ID=<id>` (backend `.env`). Restart both.
3. Load **/login** — the "Continue with Google" button now appears (it's hidden when the id isn't set).
4. Click it, pick a Google account. Expect: you're signed in and a `User` row exists for that email
   (check `POST /entities/User/filter` or the app). Sign out and back in to confirm find-or-create works.

## Step 7 — Definition of done for Phase 2
- [ ] `docker compose up` clean; `/health` shows 526 functions
- [ ] Smoke test all green (now includes signup, reset, and Google endpoint checks)
- [ ] Password reset verified end-to-end via Mailhog (Step 6b-A)
- [ ] Google sign-in verified with a real account (Step 6b-B), if you're enabling it
- [ ] 10–15 hand-picked functions verified end-to-end
- [ ] Query-translator edge cases found in Step 5 fixed in `sdk/db.ts`
- [ ] Frontend runs against the backend; login + a few core flows work
- [ ] List of anything still failing → becomes the Phase-3 backlog

---

### Notes & known gaps (carried into Phase 3)
- **Agents (76):** not wired yet — they run as scheduled tasks in Phase 3 (EventBridge/cron calling the same functions).
- **Row-level security:** entity reads aren't per-user scoped yet; audit which entities need it.
- **UploadFile / S3** and **SES** email at scale: Phase 3.
- **Rate limits / throughput:** put LLM + email behind SQS + a worker for load (Phase 3).
- **Data migration** from Base44 + cutover: Phase 4.

See `MIGRATION-PLAN.md` for the full phase breakdown and cost/risk notes.
