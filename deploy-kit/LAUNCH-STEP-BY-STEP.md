# Launch — Step by Step (developer handoff)
## GamerGain / PlayEarning Nexus · using the pre-built execution kit

**How to read this:** every step is tagged with who does it —
🧍 **OWNER** (only you can; needs your identity/card) · 🛠 **DEVELOPER** (following the kit) ·
🤖 **SCRIPT** (`launch.sh` does it) · ⏳ **WAIT** (external review/approval; nobody can rush it).

**Cost of the developer's part:** with the automation now in the kit (see the cheat-sheet at the
bottom), the 🛠 steps total **~30–45 hours at $75/hour = ~$2,250–$3,375** for the full PWA + Android +
iOS launch — or **~$2,850–$4,275 with the user-capacity load test**. The 🧍 owner steps and the fixed
fees (Apple $99/yr, Google $25, domain, hosting) are separate — see `GamerGain-Launch-Estimate.pdf`.
The per-phase hours below are the pre-automation figures; the cheat-sheet scripts bring them down.

---

## PHASE 0 — Create the accounts (🧍 OWNER)  ·  ~a few hours of signups
You do these first; the developer can't (they need your identity, card, and legal agreement). Create
an account and get the key for each, then write them into `API-KEYS-WORKSHEET.md`:

- Hosting: **Railway** (railway.app)
- Database: Railway Postgres (or Neon/Supabase)
- AI: **OpenAI** (or Anthropic)
- Email: **SendGrid** (or SES)
- File storage: **AWS S3**
- Payments: **Stripe** and **PayPal**
- Surveys: **BitLabs**
- SMS (optional): **Twilio**
- Google sign-in (optional): **Google Cloud OAuth**
- Mobile: **Apple Developer** ($99/yr) and **Google Play Console** ($25)
- A **domain** for your app

## PHASE 1 — Fill in the keys (🧍 OWNER)  ·  ~30 min
- Open **`API-KEYS-WORKSHEET.md`** and paste in every value from Phase 0.
- Hand the developer: the repo, this file, and the filled-in worksheet. They now have everything.

## PHASE 2 — Prep & validate (🛠 DEVELOPER + 🤖 SCRIPT)  ·  ~2–3 h
- Developer puts the keys into `backend/.env`, then runs: **`bash deploy-kit/launch.sh`**.
- The script (🤖) checks the keys, generates the secrets that can be auto-made, validates the build,
  loads the database schema (if `psql`/DATABASE_URL available), and smoke-tests the backend.

## PHASE 3 — Deploy the backend, scheduler & frontend (🛠 DEVELOPER)  ·  ~8–11 h
- Follow **`railway/RAILWAY-DEPLOY.md`** exactly: create the Railway project, add Postgres, deploy the
  backend + scheduler + frontend, set the env vars, generate the domains.
- Done when: `/health` is green, the scheduler logs show cron jobs, and the site loads and can sign up.

## PHASE 4 — Test the money & earn loops (🛠 DEVELOPER)  ·  ~12–16 h
- Run **`PAYMENTS-TEST-CHECKLIST.md`** (Stripe/PayPal sandbox → live, buy-credit, partner payout).
- Run **`SURVEY-LOOP-TEST.md`** (BitLabs → credit → agent → oversight).
- Run **`QA-CHECKLIST.md`** on the live site.
- Run **`LOAD-TEST-PLAN.md`** — this is the **user-capacity test**: measure how many concurrent users
  the app handles, find where it bends first, and resize the servers from the real numbers. (+8–12 h;
  this is what turns "should handle 100k" into a measured figure you can trust.)

## PHASE 5 — Build & submit the apps (🛠 DEVELOPER + ⏳ WAIT)  ·  ~15–22 h + review wait
- Add the signing secrets (see `ANDROID-SUBMISSION-KIT.md` / `IOS-NO-MAC-KIT.md`), then in GitHub →
  **Actions** run **Android Build & Play** and **iOS Build & TestFlight** (builds in the cloud — no Mac).
- 🧍 OWNER + 🛠 DEVELOPER: fill the store listings (copy is provided), add the demo login, submit.
- ⏳ WAIT for Google and Apple review (days; iOS can need a resubmit — the kit's reviewer notes help).

## PHASE 6 — Legal (🧍 OWNER, in parallel)  ·  not developer time
- Get the provided Privacy Policy + Terms reviewed by a lawyer; publish them at public URLs.

## PHASE 7 — Go live (🛠 DEVELOPER)  ·  final checks
- Point your custom domain + HTTPS, flip payments to live, confirm the go-live checklist, turn the
  cron schedules on.

---

## The hand-off checklist (give the developer all of this)
- [ ] The repo (already on GitHub) + this `LAUNCH-STEP-BY-STEP.md`
- [ ] The filled-in `API-KEYS-WORKSHEET.md`
- [ ] Access to the accounts they need to deploy (Railway, GitHub Actions secrets)
- [ ] The `deploy-kit/` folder (they'll follow its files phase by phase)

## What only YOU (owner) must do — the short list
1. Create the accounts (Phase 0) and pay the fees (Apple $99, Google $25, domain, hosting).
2. Fill in the keys worksheet (Phase 1).
3. Get the legal pages lawyer-reviewed (Phase 6).
4. Approve going live.
Everything else is the developer following the kit — **~30–45 hours, ~$2,250–$3,375 at $75/hr** (with the new automation).

---

## Automation cheat-sheet (run these instead of doing it by hand)
- `node deploy-kit/env-check.mjs` — verify every key works before deploying
- `bash deploy-kit/railway/railway-deploy.sh` — provision + deploy on Railway (backend serves frontend, schema auto-loads, scheduler inline)
- `deno run -A backend/tools/seed-demo.ts` — seed demo data
- `BACKEND_URL=… node deploy-kit/e2e-smoke.mjs` — one-command critical-path smoke test
- `BACKEND_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… node deploy-kit/go-live.mjs` — **the go-live gate**: verify every feature is ON, pre-warm the catalog so the site is full of content before the first user, smoke-test, and print GO / NO-GO (see `PRELAUNCH-GO-LIVE.md`)
- `node backend/tools/validate-guardrails.mjs` && `node backend/tools/agent-smoke.mjs` — pre-launch agent checks
- Mobile: push to the `android-release` / `ios-release` branch (CI builds + auto-bumps the build number); `fastlane` submits
- App review: give reviewers the `/ReviewerLogin` URL (set `REVIEWER_DEMO=1`)
