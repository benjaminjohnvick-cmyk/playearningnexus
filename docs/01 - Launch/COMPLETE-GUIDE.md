# GamerGain / PlayEarning Nexus — Complete Guide (All-in-One)

_Regenerated July 21, 2026 from the current, self-hosted guides. **No Base44.** This single document stitches together every launch, mobile, legal, and architecture guide so you can read or print everything in one place. Each section below is the same file that lives on its own in the folders._

Repo: https://github.com/benjaminjohnvick-cmyk/playearningnexus


> This combined guide **excludes** the raw source dumps (`SELF-HOSTED-CODE.md`, `FULL-CODEBASE.txt`) and the validation notes, which are best read as their own files in `04 - Architecture & Migration/`.


## Contents

1. [Project Overview](#project-overview)
2. [Master Launch Guide](#master-launch-guide)
3. [Setup Runbook — API Keys & Deploy](#setup-runbook-api-keys-deploy)
4. [Config & Secrets — Every Environment Variable](#config-secrets-every-environment-variable)
5. [Phase 2 Runbook — Boot & Smoke-Test the Backend](#phase-2-runbook-boot-smoke-test-the-backend)
6. [Developer Handoff Brief](#developer-handoff-brief)
7. [Developer Job Post & Screening](#developer-job-post-screening)
8. [Mobile App Wrapper Guide (Capacitor)](#mobile-app-wrapper-guide-capacitor)
9. [App Store Submission Checklist](#app-store-submission-checklist)
10. [Legal Pages Guide](#legal-pages-guide)
11. [Compliance & Assumptions](#compliance-assumptions)
12. [How Base44 Was Removed (Architecture)](#how-base44-was-removed-architecture)
13. [Base44 → Self-Hosted API Map (1:1)](#base44-→-self-hosted-api-map-11)
14. [Features Restored After Migration](#features-restored-after-migration)
15. [Migration Plan (Phased, Reference)](#migration-plan-phased-reference)


---



# Project Overview

_Source file: `04 - Architecture & Migration/README.md`_

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

---



# Master Launch Guide

_Source file: `01 - Launch/MASTER-LAUNCH-GUIDE.md`_

# PlayEarning Nexus — Master Launch Guide (Updated)

### Everything to configure, build, and ship — in the order to do it

_Updated July 21, 2026. This is the single, end-to-end guide to take the app from code to live on web, Android, and iOS. It's ordered by best practice and efficiency: set up accounts → wire APIs → build → PWA → deploy → automate → legal → native apps → go live._

**This app is fully self-hosted — it no longer uses Base44.** The backend runs on your own Deno + PostgreSQL stack.

**Repository status:** ✅ All code is on GitHub `main` and current — the self-hosted backend, the frontend, the Capacitor mobile wrapper, the in-app legal pages, and all docs. Repo: `https://github.com/benjaminjohnvick-cmyk/playearningnexus`.

**Companion docs:** `CONFIG-AND-SECRETS.md`, `SETUP-RUNBOOK.md`, `backend/PHASE-2-RUNBOOK.md`, `DEVELOPER-HANDOFF-BRIEF.md`, `MOBILE-APP-WRAPPER-GUIDE.md`, `APP-STORE-SUBMISSION-CHECKLIST.md`, `LEGAL-PAGES-GUIDE.md`, `PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`, `COMPLIANCE-AND-ASSUMPTIONS.md`, `DE-BASE44-REWORK.md`.

## How the app is built (read first)
- **Backend** = a **self-hosted Deno service** (`/backend`). It runs the 526 functions (as HTTP routes), 239 PostgreSQL tables, JWT + Google authentication, an agent runtime, a cron scheduler, and the AI/email/image integrations. You deploy it as a container; it scales with your host. **Secrets live in your backend host's environment**, never in the repo.
- **Database** = **PostgreSQL** (schema in `backend/db/schema.sql`). Use a managed provider (Neon, Supabase, RDS) or your own.
- **Frontend** = a **React + Vite PWA** (208 pages). Public `VITE_*` values are build-time. It deploys as a static site and wraps to native via **Capacitor**. It points at the backend via `VITE_NEXUS_API_URL`.
- **Mobile** = **wrapper-only**. There are **no `android/`/`ios/` folders in the repo** — they're git-ignored and regenerated on demand with `npm run native:regenerate`. All native behavior lives in the web layer (`src/lib/native.js`).
- **Rule:** if it's a *secret*, it goes in the **backend host's env** (`backend/.env`). If it starts with `VITE_`, it's public and goes in the **frontend build** (`.env.local`).

> **New with self-hosting:** the AI/email/image features (`InvokeLLM`, `SendEmail`, `GenerateImage`, etc.) used to run free on Base44's credentials — now they use **your own** OpenAI/Anthropic, SendGrid/SES, and S3 keys. LLM usage is the main variable cost; budget for it.

---

## LAUNCH SEQUENCE AT A GLANCE
1. Create accounts (Phase 1)
2. Get all API keys (Phase 2 — the complete list)
3. Configure keys — backend host + frontend (Phase 3)
4. Build & smoke-test (Phase 4)
5. Finish the PWA — icons + install test (Phase 5)
6. Deploy the web app — host, domain, HTTPS (Phase 6)
7. Turn on backend automation schedules (Phase 7)
8. Legal & compliance (Phase 8)
9. Build the native apps (Phase 9)
10. Final QA & go live (Phase 10)

---

## PHASE 1 — Accounts to create first
| Account | For | Cost |
|---|---|---|
| **Backend host** (Render / Railway / Fly.io / AWS) | Runs the Deno backend container | pay-as-you-go |
| **Managed Postgres** (Neon / Supabase / RDS) | The database | free tier → pay-as-you-go |
| **OpenAI or Anthropic** | LLM features (was free via Base44) | usage-based |
| **SendGrid or AWS SES** | Email (reset/invite/notifications) | free tier → usage |
| **AWS S3** (or compatible) | File uploads | pay-as-you-go |
| **Google Cloud** (optional) | "Sign in with Google" OAuth client | free |
| **Stripe** | Card payments | free; fees per txn |
| **PayPal Developer** (Business) | PayPal payments + payouts | free; fees |
| **BitLabs** | Third-party survey supply | revenue share |
| **Twilio** | SMS notifications | pay-as-you-go |
| **Meta for Developers** | Facebook + Instagram login/posting | free |
| **X (Twitter) Developer** | Twitter/X posting | free tier/paid |
| **Snap Kit (Snapchat)** | Snapchat integration | free |
| **ScrapingBee** + **Browserless** | Competitive-intel scraping | paid tiers (optional at launch) |
| **AWS** (or Amplify) | Frontend hosting | pay-as-you-go |
| **Domain registrar** | Your custom domain | ~$12/yr |
| **Google Play Console** | Android app | $25 one-time |
| **Apple Developer Program** | iOS app (needs a Mac) | $99/yr |

---

## PHASE 2 — COMPLETE API / KEY LIST
Everything the code references. "Where" = backend host env (`backend/.env`), or frontend `.env`. "Priority" = needed to launch vs. can follow.

### A. Backend secrets — set in your backend host's env / `backend/.env` (never in the repo)

**Self-hosted platform (new — these replace what Base44 used to provide):**
| Key | Powers | Where to get it | Priority |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Your managed Postgres provider | **Required** |
| `AUTH_JWT_SECRET` | Signs user login tokens | Generate a long random string | **Required** |
| `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) | LLM / agents / image / speech | OpenAI or Anthropic dashboard | **Required** (AI features) |
| `SENDGRID_API_KEY` (or SES/SMTP) | Email (reset, invites, notifications) | SendGrid, or AWS SES | **Required** (auth email) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` / `AWS_REGION` | File uploads → S3 | AWS IAM + S3 | High |
| `GOOGLE_CLIENT_ID` | Verify "Sign in with Google" | Google Cloud Console | Optional |
| `FRONTEND_URL` | Password-reset links | Your frontend domain | **Required** |

**Your app integrations:**
| Key | Powers | Where to get it | Priority |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Card charges/payouts | Stripe → Developers → API keys (Secret `sk_live_…`) | **Required** |
| `PAYPAL_CLIENT_ID` | PayPal API | PayPal Developer → Apps & Credentials | **Required** |
| `PAYPAL_SECRET_KEY` | PayPal API | PayPal Developer → Apps → Secret | **Required** |
| `PAYOUT_WEBHOOK_URL` | Payout webhook target | Your endpoint URL | **Required** if using payout webhooks |
| `PAYOUT_WEBHOOK_SECRET` | Verify payout webhooks | A random secret you generate | **Required** if using payout webhooks |
| `BITLABS_API_KEY` | External survey offers | BitLabs dashboard → API | **Required** (core earning) |
| `TWILIO_ACCOUNT_SID` | SMS | Twilio Console | High (SMS features) |
| `TWILIO_AUTH_TOKEN` | SMS | Twilio Console | High |
| `TWILIO_PHONE_NUMBER` | SMS sender | Twilio → Phone Numbers | High |
| `VAPID_PUBLIC_KEY` | Web push | Generate: `npx web-push generate-vapid-keys` | High |
| `VAPID_PRIVATE_KEY` | Web push | Same command (keep private) | High |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | FB login + posting | Meta for Developers → your app | Medium |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | IG posting | Meta for Developers → your app | Medium |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | X posting | X Developer Portal | Medium |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Snapchat | Snap Kit portal | Low |
| `SCRAPINGBEE_API_KEY` | Web scraping (intel) | ScrapingBee | Low (optional) |
| `BROWSERLESS_API_KEY` | Headless browser | Browserless.io | Low (optional) |
| `APP_URL` | Absolute links in emails/webhooks | Your production URL | **Required** |

### B. Frontend variables — set at build time (`.env.local` / host env)
| Key | Powers | Where to get it | Priority |
|---|---|---|---|
| `VITE_NEXUS_API_URL` | Your backend URL | Your deployed backend (e.g. `https://api.yourdomain.com`) | **Required** |
| `VITE_GOOGLE_CLIENT_ID` | "Continue with Google" button | Google Cloud Console (same client id) | Optional |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe checkout (public) | Stripe → API keys (`pk_live_…`) | **Required** |
| `VITE_PAYPAL_CLIENT_ID` | PayPal buttons (public) | PayPal Developer | **Required** |
| `VITE_VAPID_PUBLIC_KEY` | Web push (public half) | Same VAPID pair as backend | High |

### C. AI / email / image / file — now use YOUR keys (no longer free via Base44)
`InvokeLLM`, `GenerateImage`, `GenerateSpeech`, `SendEmail`, `UploadFile` used to run on Base44's platform credentials. Self-hosted, they use your own: **LLM** → `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; **email** → SendGrid/SES; **uploads** → S3 (all in Phase 2-A above). LLM usage is the main variable cost.

### D. Free / no-key external services (already working)
- **Maps:** React Leaflet + OpenStreetMap tiles — no key.
- **Currency rates:** exchangerate-api.com free endpoint — no key.

### E. Payout methods present in code
PayPal and Stripe (keyed above). **Venmo** and **Cash App** payout functions exist; these typically route through PayPal/manual review rather than a separate API key — confirm your payout operations before enabling.

> Full details and exact variable names: `CONFIG-AND-SECRETS.md` and `SETUP-RUNBOOK.md`.

---

## PHASE 3 — Configure the keys
1. **Backend:** set every key from Phase 2-A in your backend host's environment (or `backend/.env` locally). Start from `backend/.env.example`.
2. **Frontend:** create `.env.local` in the repo root with the Phase 2-B values (and set the same in your host's build settings later). Example:
```
VITE_NEXUS_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=xxx            # optional (Google sign-in)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_PAYPAL_CLIENT_ID=xxx
VITE_VAPID_PUBLIC_KEY=xxx
```
3. **Deploy the backend** container and load `backend/db/schema.sql` into your Postgres so functions/tables/agents are live. (Locally: `cd backend && docker compose up`.)

## PHASE 4 — Build & smoke-test
```
git clone https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
cd playearningnexus
npm install
npm run build        # must produce ./dist with no errors
npm run lint         # optional but recommended
npm run preview      # open the built app locally and click through
```
Verify: sign-in works, a Stripe/PayPal **test-mode** transaction completes, a survey/referral action credits.

## PHASE 5 — Finish the PWA (works on Android + iOS)
The manifest, mobile meta tags, and a **placeholder icon set** are already in the repo. Remaining:
1. **Swap in your real icon.** Replace `assets/icon.png` with your final **1024×1024** PNG, then run `npm run cap:assets` to regenerate `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, and `apple-touch-icon.png`. (Placeholders ship now so it builds; use your real logo before launch.)
2. **Confirm the service worker** is registered and caching what you want.
3. **Test install:** deploy (Phase 6), then on **Android Chrome** use "Add to Home screen / Install app"; on **iOS Safari** use Share → "Add to Home Screen." Confirm it opens full-screen with your icon and name.
> A well-formed PWA installs on both platforms from the browser. For **app-store** distribution, do Phase 9.

## PHASE 6 — Deploy the web app
1. Build output is `./dist` (static).
2. Host on **AWS Amplify Hosting** (recommended: CDN + auto-scaling + CI/CD) or **S3 + CloudFront**.
3. **SPA history fallback (required):** the app uses `BrowserRouter`, so redirect `404/403 → /index.html` (Amplify: a single rewrite rule; S3/CloudFront: error-document or a CloudFront function). Without this, deep links break.
4. Set the `VITE_*` env vars in the host's build settings.
5. **Custom domain + HTTPS:** attach your domain and an ACM certificate.
6. Point `VITE_NEXUS_API_URL` (frontend) and `APP_URL` / `FRONTEND_URL` (backend) at production.
7. **Confirm the public legal URLs resolve** (needed for the app stores): `https://yourdomain.com/PrivacyPolicy` and `/TermsOfService`.

## PHASE 7 — Turn on backend automation (schedules)
Your automation functions run on a schedule via the included scheduler (`backend/scheduler`, uses `Deno.cron`) or your host's cron / AWS EventBridge. Recommended cadence:
- **Daily:** `autoReferralContestDaily`, `autonomousEcosystemEngine` (if `EcosystemConfig.autonomous_mode` = true), `creditPendingReferralPostRewards` (grace-period sweep), `autoDailyOperationsEngine`, `generateAIDailyGoal`, survey generation.
- **Weekly:** `processWeeklyJackpot` (the merit-based, open, self-funding prize pool), `generateWeeklyReferralCampaign` + `concludeWeeklyReferralCampaign`, `generateWeeklyFeatureVoteSurvey` + `concludeWeeklyFeatureVote`, `weeklyContestWinner`, `autoWeeklyReportsEngine`.
- **Every 6–12h:** `masterOrchestrator`, `aiOrchestrator`.
- **Set platform config:** `GlobalSettings` (e.g., prize-pool contribution), admin credentials, and default `EcosystemConfig` / `ReferralJackpot` values (entry fee, `pool_funding_rate`).

## PHASE 8 — Legal & compliance (do before public launch)
The in-app pages exist (`src/pages/PrivacyPolicy.jsx`, `src/pages/TermsOfService.jsx`) and matching docs (`PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`) — but they are **templates with `[BRACKET]` placeholders and must be completed and lawyer-reviewed**. See `LEGAL-PAGES-GUIDE.md`. From `COMPLIANCE-AND-ASSUMPTIONS.md`:
- **Privacy Policy + Terms of Service** — fill in every placeholder, publish at public URLs, have a lawyer review. Required by app stores and law.
- **Data privacy:** GDPR/CCPA consent capture + opt-out (you collect demographics and survey data).
- **FTC disclosures** on referral/affiliate posts (already enforced in code as `#ad`).
- **Contest rules** for the **merit-based** prize pool + feature votes (official rules, eligibility, state gating). Note: the prize pool is skill/merit-based and open to all — **not** a random draw — which is deliberate for legality; keep it that way.
- **Money-transmitter/escrow review** before enabling real-cash pooling in Shared Wallet Groups (currently closed-loop credits).
- **MLM/referral commission review** (pyramid-scheme rules — tie rewards to real sales).
- **Payments:** confirm Stripe/PayPal accounts verified, tax reporting (1099 thresholds), and payout compliance.

## PHASE 9 — Native apps (Android + iOS)
Follow `MOBILE-APP-WRAPPER-GUIDE.md`. The repo is **wrapper-only** (Capacitor configured; native folders regenerated, not committed). Summary:
1. `npm install` → put your **1024×1024** icon at `assets/icon.png`.
2. `npm run native:regenerate` — one command: builds `dist/`, generates icons, creates the `android/` (and, on a Mac, `ios/`) shells, and syncs. Re-run this whenever you build; never commit the generated folders.
3. Open in **Android Studio** (`npm run cap:open:android`) / **Xcode** (`npm run cap:open:ios`, **Mac only**), set version + signing, build a signed `.aab` / archive.
4. Submit to **Google Play** and **App Store** — see the full **`APP-STORE-SUBMISSION-CHECKLIST.md`** before you upload.
> Store-review watch-outs: Apple Guideline 4.2 (not "just a website"), and extra scrutiny on **earning/rewards/payments** apps. In your Apple review notes, explain that the prize pool and referral rewards are **skill/merit-based, not gambling**, and include a demo login. **Keep your Android signing keystore safe** — you need it for every future update.

## PHASE 10 — Final QA & go-live checklist
- [ ] Clean `npm run build` (no errors)
- [ ] All **Required** keys set in the backend host env + frontend
- [ ] Backend **published**; entities/functions/agents live
- [ ] Sign-in / OAuth works in production
- [ ] Real (small) Stripe + PayPal transaction succeeds
- [ ] Payout path tested end-to-end
- [ ] Survey → credit flow works (internal + BitLabs)
- [ ] Referral post + reward credit works (with `#ad` disclosure)
- [ ] Web push (and SMS if used) fire
- [ ] PWA installs on Android + iOS; deep links work (SPA fallback OK)
- [ ] Automation schedules enabled (Phase 7)
- [ ] Privacy Policy + Terms **completed, lawyer-reviewed, live, and linked**
- [ ] Custom domain + HTTPS active
- [ ] Real app icon swapped in (not the placeholder)
- [ ] Error monitoring in place (optional: add Sentry/logging)
- [ ] `APP-STORE-SUBMISSION-CHECKLIST.md` completed (if launching on stores)
- [ ] Native apps approved (if launching on stores)

---

## What's already done (so you don't redo it)
- ✅ Full codebase (208 pages, 526 functions, 235 databases, 76 agents) — built and **verified live on GitHub `main`**.
- ✅ All API integrations **wired in code** (every key above is already read via `Deno.env.get` / `import.meta.env`) — you only supply values.
- ✅ PWA manifest + mobile meta tags + service worker + **placeholder icon set**.
- ✅ **Wrapper-only** Capacitor setup for Android/iOS (`npm run native:regenerate`; native folders git-ignored).
- ✅ Compliance changes (opt-in participation, FTC `#ad` disclosure, **merit-based open self-funding prize pool**, closed-loop wallets).
- ✅ In-app **Privacy Policy** and **Terms** pages (template state — needs your details + lawyer review).
- ✅ Docs: this guide + config, setup, wrapper, legal, compliance, app-store checklist, and push-steps references.

## What only you can do (needs your accounts/machine)
- Supply the real API key **values** (Phase 2–3).
- Deploy the backend container + Postgres, and turn on the scheduler (Phase 7).
- Deploy the frontend + domain (Phase 6).
- Complete + legally review the Privacy Policy and Terms (Phase 8).
- Swap in the real app icon and generate/submit the native apps — iOS requires a **Mac** (Phase 9).

---

## Quick reference — the commands you'll actually run
```
# Get the code
git clone https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
cd playearningnexus && npm install

# Web: build, check, preview
npm run build && npm run preview

# Icons (after placing assets/icon.png, 1024x1024)
npm run cap:assets

# Native apps (wrapper-only; regenerates android/ and ios/)
npm run native:regenerate
npm run cap:open:android      # Android Studio
npm run cap:open:ios          # Xcode (Mac only)
```

---



# Setup Runbook — API Keys & Deploy

_Source file: `01 - Launch/SETUP-RUNBOOK.md`_

# PlayEarning Nexus — Setup Runbook (API Keys & Deploy)

A one-page checklist to wire up the app. Nothing here is new — every variable below is already referenced in the code. Work top to bottom.

> **Self-hosted — no Base44.** The backend is your own Deno service + PostgreSQL in `/backend`.

## How the app is split (read this first)
- **Backend** (functions, database, agents) is a **self-hosted Deno service** in `/backend`. Its secrets go in the **backend host's environment** (or `backend/.env`) — never in the repo. It scales with your host.
- **Frontend** (the React site) is a static build. Its variables are **public, build-time** `VITE_*` values that go in `.env.local` (local) or your host's env settings.
- **Rule of thumb:** if it's a *secret* (a "secret key", "auth token", "app secret"), it goes in the **backend env**. If it starts with `VITE_`, it's public and goes in the **frontend**.

---

## Step 1 — Frontend variables (public, build-time)
Create `.env.local` in the project root (and set the same values in your host's build env). These are safe to expose in the browser bundle.

| Variable | What it's for | Where to get it |
|---|---|---|
| `VITE_NEXUS_API_URL` | **Your backend URL** | Your deployed backend (e.g. `https://api.yourdomain.com`) |
| `VITE_GOOGLE_CLIENT_ID` | "Continue with Google" button (optional) | Google Cloud Console |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe checkout (public key) | Stripe Dashboard → Developers → API keys → **Publishable** key (`pk_live_…`) |
| `VITE_PAYPAL_CLIENT_ID` | PayPal buttons (public client id) | PayPal Developer → Apps & Credentials → **Client ID** |
| `VITE_VAPID_PUBLIC_KEY` | Web push (public key) | Same VAPID key pair as backend (public half) |

Example `.env.local`:
```
VITE_NEXUS_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_PAYPAL_CLIENT_ID=xxx
VITE_VAPID_PUBLIC_KEY=xxx
```

---

## Step 2 — Backend secrets (set in the backend host env / `backend/.env`, NOT in the repo)
Add each key below to your backend host's environment. Start from `backend/.env.example`. Values are never committed.

**Self-hosted platform (new — replaces what Base44 provided)**
| Secret | For | Where to get it |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Managed Postgres (Neon/Supabase/RDS) |
| `AUTH_JWT_SECRET` | Signs user login tokens | Generate a long random string |
| `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) | LLM / agents / image / speech | OpenAI or Anthropic |
| `SENDGRID_API_KEY` (or `EMAIL_PROVIDER=ses`/`smtp`) | Email (reset/invite/notifications) | SendGrid or AWS SES |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` / `AWS_REGION` | File uploads → S3 | AWS |
| `GOOGLE_CLIENT_ID` | Verify Google sign-in | Google Cloud Console |
| `FRONTEND_URL` | Password-reset links | Your frontend domain |

**Payments**
| Secret | For | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe charges/payouts | Stripe → API keys → **Secret** key (`sk_live_…`) |
| `PAYPAL_CLIENT_ID` | PayPal API | PayPal Developer → Apps & Credentials |
| `PAYPAL_SECRET_KEY` | PayPal API | PayPal Developer → Apps & Credentials → **Secret** |
| `PAYOUT_WEBHOOK_URL` | Payout webhook target | Your webhook endpoint URL |
| `PAYOUT_WEBHOOK_SECRET` | Verify payout webhooks | A random secret you generate |

**Surveys / data**
| Secret | For | Where to get it |
|---|---|---|
| `BITLABS_API_KEY` | BitLabs survey offers | BitLabs dashboard → API |
| `SCRAPINGBEE_API_KEY` | Web scraping (competitive intel) | ScrapingBee dashboard |
| `BROWSERLESS_API_KEY` | Headless browser tasks | Browserless.io account |

**Social platforms (OAuth + posting)**
| Secret | For | Where to get it |
|---|---|---|
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook login & posting | Meta for Developers → your app |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram posting | Meta for Developers → your app |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Twitter/X posting | X Developer Portal → your app |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Snapchat integration | Snap Kit developer portal |

**Messaging / notifications**
| Secret | For | Where to get it |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | SMS (Twilio) | Twilio Console |
| `TWILIO_AUTH_TOKEN` | SMS (Twilio) | Twilio Console |
| `TWILIO_PHONE_NUMBER` | SMS sender number | Twilio Console → Phone Numbers |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push | Generate a VAPID key pair (e.g. `npx web-push generate-vapid-keys`) |

**App**
| Secret | For | Where to get it |
|---|---|---|
| `APP_URL` | Absolute links in emails/webhooks | Your production site URL (e.g. `https://yourdomain.com`) |

---

## Step 3 — AI / email / image now use YOUR keys
`InvokeLLM`, `GenerateImage`, `GenerateSpeech`, `SendEmail`, `UploadFile` used to run free on Base44's
credentials. Self-hosted, they use the keys you set in Step 2 (OpenAI/Anthropic, SendGrid/SES, S3).
No extra config beyond those env vars.

---

## Step 4 — Deploy the backend
1. Provision a **Postgres** database and load the schema: `psql "$DATABASE_URL" -f backend/db/schema.sql`.
2. Deploy the **Deno backend** as a container (Dockerfile included) to Render / Railway / Fly.io / AWS,
   with the Step-2 env vars set. Locally: `cd backend && docker compose up`.
3. Confirm `https://your-backend/health` returns `{"ok":true, ...}`.
4. Set the frontend's `VITE_NEXUS_API_URL` to this backend URL.

## Step 5 — Build & deploy the frontend
```
npm install
npm run build      # outputs ./dist
```
Deploy `./dist` to either:
- **AWS Amplify Hosting** (recommended): connect the repo, build command `npm run build`, output directory `dist`, add the `VITE_*` vars, and add one SPA rewrite: `/<*>` → `/index.html` (200). CDN + auto-scaling are built in.
- **S3 + CloudFront**: upload `dist` to an S3 bucket, front it with CloudFront. **Required:** set the SPA fallback so deep links work — error responses 403 and 404 → `/index.html` with 200 (the app uses `BrowserRouter`). Add an ACM cert for HTTPS + your custom domain.

## Step 6 — Verify
- [ ] Site loads; deep link (e.g. `/WeeklyReferralContest`) works (SPA fallback OK)
- [ ] Sign-in works (backend reachable via `VITE_NEXUS_API_URL`; `/login` + `/signup` work)
- [ ] A Stripe/PayPal test transaction completes
- [ ] A test survey/referral action credits correctly
- [ ] Web push / SMS fire (if used)
- [ ] Public legal pages resolve: `/PrivacyPolicy` and `/TermsOfService` (required by the app stores)

---

## Next: native apps & store submission
This runbook covers **API keys and web deploy** only. For the mobile apps, continue with:
- `MOBILE-APP-WRAPPER-GUIDE.md` — turn the PWA into Android/iOS apps (wrapper-only Capacitor; `npm run native:regenerate`).
- `APP-STORE-SUBMISSION-CHECKLIST.md` — everything to complete before uploading to Google Play / the App Store.

> Full key inventory and security notes: `CONFIG-AND-SECRETS.md`. Pre-launch legal items (MLM, data privacy, contest/sweepstakes, money-transmitter): `COMPLIANCE-AND-ASSUMPTIONS.md`.

---



# Config & Secrets — Every Environment Variable

_Source file: `01 - Launch/CONFIG-AND-SECRETS.md`_

# GamerGain / PlayEarning Nexus — Configuration, API Keys & Auth Inventory
### Self-hosted stack (Base44 removed)

## Summary — no secrets are stored in the code
No hardcoded secrets, API keys, or credentials live in the repo — every secret is read at runtime
from an environment variable. On the **self-hosted** stack the values live in **your backend host's
environment (or a `.env` file / secrets manager)** — never in the repo, and never in the frontend
bundle. This doc is the **list of keys you configure**.

Two places hold config:
- **Backend** (`/backend`, Deno) — reads secrets via `Deno.env.get(...)`. Set these in your host's
  env or `backend/.env` (git-ignored).
- **Frontend** (React/Vite) — public, build-time `import.meta.env.VITE_*` values in `.env.local`.

## Backend secrets — set in your backend host's env / `backend/.env`
### Core (self-hosted platform)
| Env var | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (e.g. Neon/Supabase/RDS) — **required** |
| `AUTH_JWT_SECRET` | Signs user JWTs — **required**, use a long random string |
| `FRONTEND_URL` | Builds password-reset links |
| `CORS_ORIGIN` | Your frontend domain |

### AI / email / images (formerly free via Base44 — now YOUR provider keys)
| Env var | Used for |
|---|---|
| `OPENAI_API_KEY` *(or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic`)* | `InvokeLLM`, agent runtime, `GenerateImage`, `GenerateSpeech` |
| `SENDGRID_API_KEY` *(or `EMAIL_PROVIDER=ses` + AWS keys, or `=smtp`)* | `SendEmail`, password-reset & invite emails |
| `EMAIL_FROM` | From-address for outbound email |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` | `UploadFile` → S3 |
| `GOOGLE_CLIENT_ID` | Verifies "Sign in with Google" |

### Your existing app integrations (unchanged)
| Env var | Used for |
|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET_KEY` | PayPal payouts & orders |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `BITLABS_API_KEY` | BitLabs survey provider |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Twitter/X posting |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth & posting |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram posting |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Snapchat |
| `SCRAPINGBEE_API_KEY` / `BROWSERLESS_API_KEY` | Competitive-intel scraping |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push |
| `PAYOUT_WEBHOOK_URL` / `PAYOUT_WEBHOOK_SECRET` | Payout webhook verification |
| `APP_URL` | Absolute links in emails/webhooks |

> Full annotated list with defaults: `backend/.env.example`.

## Frontend public config — `.env.local` (safe to expose; build-time `VITE_*`)
| Env var | Purpose |
|---|---|
| `VITE_NEXUS_API_URL` | **Your backend URL** (replaces the old Base44 app id/base url) |
| `VITE_GOOGLE_CLIENT_ID` | Enables the "Continue with Google" button (optional) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable (public) key |
| `VITE_PAYPAL_CLIENT_ID` | PayPal client id (public) |
| `VITE_VAPID_PUBLIC_KEY` | Web push public key |
| `VITE_LOGIN_URL` *(optional)* | Login route (default `/login`) |

> The old `VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL` / `VITE_BASE44_FUNCTIONS_VERSION` are
> **gone** — there's no Base44 to point at. Just set `VITE_NEXUS_API_URL`.

## What changed vs the Base44 version
- Secrets used to live in **Base44's secret manager**; now they live in **your backend host's env**.
- `InvokeLLM` / `GenerateImage` / `GenerateSpeech` / `SendEmail` / `UploadFile` used to run free on
  **Base44's platform credentials**; now they use **your own** OpenAI/Anthropic, SendGrid/SES, and S3
  keys (this is the real cost driver — budget for LLM usage especially).
- Auth used to be Base44-hosted; now it's **your JWT + optional Google**, so you also set
  `AUTH_JWT_SECRET` and (optionally) `GOOGLE_CLIENT_ID`.

## Recommendations
1. Set backend secrets in your **host's env or a secrets manager**, never in a committed file. Keep
   `backend/.env` git-ignored (it is).
2. **Never commit real values** — not to the repo, a Claude project doc, or a chat. If a real key
   ever lands in the repo, rotate it.
3. Publishable/public keys (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYPAL_CLIENT_ID`, VAPID public)
   are safe in the frontend build by design.

---



# Phase 2 Runbook — Boot & Smoke-Test the Backend

_Source file: `01 - Launch/PHASE-2-RUNBOOK.md`_

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

---



# Developer Handoff Brief

_Source file: `01 - Launch/DEVELOPER-HANDOFF-BRIEF.md`_

# Developer Handoff Brief — GamerGain / PlayEarning Nexus
### Scope: launch on **web + native apps (Android & iOS)**

You're being brought in to **stand up, deploy, and ship** an app whose code is already written.
This is a configuration/integration/deployment job, not a build-from-scratch job. Read this page,
then the linked docs, and you'll have everything you need. Estimated total: **~7–13 working days**
for an intermediate full-stack dev (plus external waits — app-store review, lawyer sign-off — that
don't consume your time).

---

## 1. Architecture in 30 seconds
- **Frontend:** React + Vite **PWA** (208 pages). All server calls go through one module,
  `src/api/base44Client.js`, over HTTP. Configured with `VITE_NEXUS_API_URL`.
- **Backend:** self-hosted **Deno** service in `/backend` (formerly Base44). It mounts **526
  functions** as HTTP routes, has **239 Postgres tables**, JWT + Google auth, an agent runtime,
  and a cron scheduler. Runs from `backend/server/main.ts`; Docker + docker-compose included.
- **Database:** **PostgreSQL** (schema generated in `backend/db/schema.sql`, validated on PG 16).
- **Native:** **Capacitor** wrapper (wrapper-only — `android/`/`ios/` are regenerated with
  `npm run native:regenerate`, not committed).
- **Integrations to wire (keys provided by owner):** Stripe, PayPal, Twilio (SMS), BitLabs
  (surveys), OpenAI or Anthropic (LLM), SendGrid or SES (email), Google OAuth, S3 (uploads).

## 2. What's already done — do NOT rebuild
Full frontend + backend; auth (signup/login/password-reset/Google); all 526 functions converted to
the self-hosted SDK; the 239-table schema; row-level security; agent runtime; scheduler; migration
tooling; brand-matched auth screens; and the GamerGain icon set. It **compiles and passes syntax
checks, and the DB layer is validated against real Postgres** — but it has **not been booted
end-to-end as a live service yet.** That first boot is your Phase A.

## 3. Your work, in order (with rough effort)
| Phase | Task | Effort |
|---|---|---|
| **A. Run it locally** | `cd backend && cp .env.example .env`, `docker compose up`, load `db/schema.sql` + `db/seed.sql`, run `deno run … tools/smoke-test.ts`. Fix any query-translator edge cases in `sdk/db.ts` that surface (`$or`, array-contains, pagination). **This is the de-risking step — do it first.** | 0.5–1 day |
| **B. Wire integrations** | Paste the owner's API keys into backend `.env` and frontend `.env.local`. Verify a test-mode Stripe/PayPal charge, an LLM call, an email send. | 0.5–1 day |
| **C. Deploy** | Backend (Deno) + managed Postgres + frontend static build. **Recommended for speed:** a container host (Render / Railway / Fly.io / AWS App Runner) + managed PG (Neon / Supabase / RDS) + Amplify/CloudFront for the frontend. Set the SPA fallback (`404/403 → index.html`) and HTTPS + custom domain. | 1–2 days |
| **D. User accounts / auth** | Set `AUTH_JWT_SECRET`; wire email provider for password reset; set up Google OAuth (`GOOGLE_CLIENT_ID` both sides) if wanted; verify signup→login→reset end-to-end (Mailhog steps in the Phase-2 runbook). | 0.5 day |
| **E. Native apps** | `npm run native:regenerate`; Android → signed `.aab` in Android Studio → Play Console; iOS → archive in Xcode (**Mac required**) → App Store Connect. Follow `APP-STORE-SUBMISSION-CHECKLIST.md`. | 2–4 days |
| **F. QA + go-live** | End-to-end pass on the go-live checklist (`MASTER-LAUNCH-GUIDE.md` Phase 10); turn on the backend cron schedules. | 1 day |

## 4. What the owner provides (so you're never blocked)
- **Filled-in API-key sheet** (from `CONFIG-AND-SECRETS.md`) — all values, ready to paste.
- **Domain**, a **hosting account**, an **Apple Developer** account ($99/yr) and **Google Play
  Console** account ($25). iOS work needs a **Mac with Xcode**.
- **Legal pages** completed + lawyer-reviewed (templates + `LEGAL-PAGES-GUIDE.md`).
- The **app icon** is already in the repo (GamerGain green "G", `assets/icon.png`).

## 5. Where to spend care (known gotchas)
- **Deno, not Node** — the backend runs on Deno; deploy with a Deno-capable container (Dockerfile
  provided), not a Node buildpack.
- **Query translator** (`backend/sdk/db.ts`): equality/operators/JSONB are done and tested; add
  `$or`/nested-boolean/array-contains only if a function needs them (flush out in Phase A).
- **Agents** need `OPENAI_API_KEY` to generate replies; **UploadFile** needs `S3_BUCKET` + AWS creds.
- **Earn-money app = extra app-store scrutiny.** Present it as a real app, keep the prize pool
  framed as skill/merit-based (not gambling), and give reviewers a demo login. See the checklist.
- **`functions.invoke`** returns Base44-style `{ data }` on purpose — don't "simplify" it; 58
  frontend files depend on that shape.

## 6. Read these first (in the repo root and `/backend`)
`DE-BASE44-REWORK.md` (what the stack is) → `backend/PHASE-2-RUNBOOK.md` (get it running) →
`MASTER-LAUNCH-GUIDE.md` (full sequence) → `CONFIG-AND-SECRETS.md` (keys) →
`MOBILE-APP-WRAPPER-GUIDE.md` + `APP-STORE-SUBMISSION-CHECKLIST.md` (native) →
`BASE44-TO-SELFHOSTED-MAP.md` (how the API surface maps, if you're curious about the migration).

## 7. Definition of done
- [ ] Backend live (managed PG + Deno host), `/health` green, scheduler on
- [ ] Frontend live on the domain with HTTPS; deep links work
- [ ] Signup / login / password-reset / (Google) all working against production
- [ ] Test-mode Stripe + PayPal transaction succeeds; a payout path tested
- [ ] A survey → reward credit and a function invocation both work end-to-end
- [ ] Privacy/Terms live at public URLs
- [ ] Android `.aab` submitted to Play; iOS archive submitted to App Store

## 8. How to keep the bill down (owner notes)
- Owner creates all the third-party **accounts + keys** — don't pay dev hours for signup forms.
- Have the dev do **Phase A (local boot) before anything else** — it's cheap and de-risks the rest.
- Use **managed Postgres + a container host** rather than hand-built AWS to save DevOps days.
- **Legal review runs in parallel** — it's not developer work and shouldn't block them.

---



# Developer Job Post & Screening

_Source file: `01 - Launch/DEVELOPER-JOB-POST.md`_

# Hiring Kit — GamerGain / PlayEarning Nexus
Two things you can use right away: a **job post** to publish (Upwork/LinkedIn/etc.), and a set of
**screening questions** (with what a good answer looks like) to make sure a candidate actually knows
the stack before you hire.

---

## PART 1 — Job Post (copy/paste, edit the [brackets])

**Title:** Full-Stack Dev to Deploy & Launch an Existing Web + Mobile App (Deno + Postgres + React + Capacitor)

**Overview**
I have a finished codebase for a play-to-earn web app (surveys, games, referrals, rewards) and need
an experienced full-stack developer to **deploy it and ship it to web + the app stores**. The code is
written and on GitHub — this is a configuration, integration, deployment, and app-submission job, not
a build-from-scratch project. I have a complete handoff brief and setup docs ready for you.

**The stack**
- Frontend: React + Vite PWA (already built)
- Backend: self-hosted **Deno** service — 526 HTTP function routes, JWT + Google auth, an agent
  runtime, a cron scheduler (Docker + docker-compose included)
- Database: **PostgreSQL** (schema is generated and validated)
- Native apps: **Capacitor** wrapper for Android + iOS
- Integrations to wire (I provide the API keys): Stripe, PayPal, Twilio, an LLM provider
  (OpenAI/Anthropic), email (SendGrid/SES), Google OAuth, S3

**What you'll do**
1. Boot the backend locally (docker compose), run the included smoke test, fix any DB query edge
   cases that surface.
2. Wire my API keys into the backend/frontend env and verify test-mode payments, email, and LLM.
3. Deploy: managed Postgres + a container host for the Deno backend + static hosting for the
   frontend, with a custom domain + HTTPS.
4. Configure user accounts/auth (JWT, email password-reset, optional Google sign-in).
5. Build and submit the Android and iOS apps (Capacitor → Android Studio / Xcode). **iOS requires a
   Mac.**
6. Final QA against my go-live checklist.

**What I provide**
- Full source on GitHub + a one-page developer handoff brief + detailed setup/runbook docs
- All third-party accounts and API keys, ready to paste
- Domain, hosting budget, Apple Developer + Google Play accounts, finished legal pages

**Requirements**
- Strong React + Node/**Deno** and **PostgreSQL** experience
- Have shipped at least one app to the **Apple App Store and Google Play** (Capacitor/Cordova/RN)
- Comfortable with Docker and a modern host (Render/Railway/Fly.io/AWS)
- Clear communicator; can work from written docs

**Nice to have:** experience with payments (Stripe/PayPal), earn-money/rewards app store policies,
serverless/JWT auth.

**Scope & budget:** Estimated **~7–13 working days**. Please quote **fixed-price for the milestones
below**, or an hourly rate + estimated hours. Milestones: (1) running locally + smoke test green,
(2) deployed to a staging URL, (3) production web launch, (4) both apps submitted.

**To apply:** In 3–4 sentences, tell me (a) an app you shipped to both stores and your role, (b) how
you'd host a Deno backend + Postgres, and (c) your estimate for this scope. Applications that just
say "I can do this" will be skipped.

---

## PART 2 — Screening Questions (with what a good answer looks like)

Use these in a short written reply or a 20-minute call. You're checking they actually know the
specific stack — a strong candidate answers these easily; a weak one gets vague.

**1. "The backend runs on Deno, not Node. How do you deploy a Deno service, and how is it different
from deploying a Node app?"**
✅ Good: mentions Deno's built-in permissions (`--allow-net/env/read`), running via the provided
Dockerfile on a container host (Render/Fly/Railway/Cloud Run), that there's no `npm install` /
`node_modules` step the same way, and Deno uses URL/`npm:` imports. 🚩 Weak: "it's basically the same
as Node" with no specifics, or assumes a Node buildpack will just work.

**2. "It's a document-style Postgres schema (data in JSONB). How would you make a query like 'find
active rows for this user' fast?"**
✅ Good: GIN index on the JSONB column, containment (`@>`) queries, promoting hot fields to real
columns/indexes, `EXPLAIN` to confirm index use. 🚩 Weak: "add an index" with no mention of JSONB/GIN,
or wants to redesign the whole schema.

**3. "You need to ship this exact web app to the App Store and Play Store. Walk me through it."**
✅ Good: Capacitor `cap add/sync`, Android signed `.aab` via Android Studio + keystore safekeeping,
iOS archive in Xcode on a Mac + App Store Connect, and knows **earn-money apps get extra review**
(privacy labels, IAP rules, demo account for reviewers). 🚩 Weak: only knows one platform, or doesn't
mention signing/keystore or review requirements.

**4. "How would you set up JWT auth and Google sign-in for this, and store passwords safely?"**
✅ Good: verify a signed JWT per request, hash passwords (bcrypt/scrypt/argon2 or salted SHA), verify
Google ID tokens server-side (aud check), never trust the client. 🚩 Weak: storing plaintext or
comparing passwords client-side; can't explain token verification.

**5. "The app calls Stripe, PayPal, Twilio, and an LLM API. How do you keep those keys safe and stop
the app from breaking when a provider rate-limits you?"**
✅ Good: secrets in server env / a secrets manager (never in the repo or frontend bundle), a queue or
concurrency limiter with retry/backoff on 429s, test-mode first. 🚩 Weak: putting secret keys in the
frontend, or no idea about rate-limit handling.

**6. "My first ask is to run it locally and run the smoke test before deploying. Why does that order
matter?"**
✅ Good: de-risks cheaply — catches integration/DB issues on localhost before paying for infra and
before app-store submission; a broken build shouldn't be discovered in production. 🚩 Weak: wants to
deploy first, or dismisses local testing.

**7. (Judgment) "The docs say the reward/prize pool must stay skill/merit-based, not gambling. Why
would a developer need to care about that?"**
✅ Good: understands it affects app-store approval and legal/compliance, not just code — won't
"optimize" it into a random draw. 🚩 Weak: treats it as irrelevant to their job.

**Red flags overall:** won't read documentation; wants to rewrite the whole thing "properly" before
launching; has never shipped to an app store; evasive about the Deno/Postgres specifics; quotes a
price without asking a single clarifying question.

**Green flags:** asks to see the repo and the handoff brief, asks clarifying questions about hosting
budget and which LLM/email provider you want, gives a milestone-based estimate, and has real store
links to apps they've shipped.

---



# Mobile App Wrapper Guide (Capacitor)

_Source file: `02 - Mobile Apps/MOBILE-APP-WRAPPER-GUIDE.md`_

# PlayEarning Nexus — Android & iOS App Wrapper Guide (Capacitor)

This turns your existing PWA into real, submittable **Android (Google Play)** and **iOS (App Store)** apps using **Capacitor**. Capacitor wraps your web build (`dist/`) in a thin native shell.

## Architecture: wrapper-only (no committed native folders)
This project is set up so the repository contains **only the web app + the Capacitor wrapper** — there are **no `android/` or `ios/` project folders in git**. Those are treated as generated build artifacts:
- They're **git-ignored** (`.gitignore`) and **regenerated on demand** with `npm run native:regenerate` (which runs `cap add` + `cap sync`).
- All native behavior (status bar, splash screen, Android back button) is implemented in the **web/TS layer** via Capacitor plugins in `src/lib/native.js` — so there is **no hand-written native code to maintain**.
- Result: one wrapper that evolves with your web app; nothing native to keep in sync by hand.

Trade-off to know: this clean model is ideal when you don't need custom native source. If you later add a plugin that requires editing native files directly, you'd commit `android/`/`ios/` at that point. For a pure web wrapper, generated-and-ignored is best practice.

## What I already added to your repo (the "code" part)
These files are in the codebase now — you don't need to create them:
- **`capacitor.config.json`** — app id (`com.playearningnexus.app`), app name, `webDir: dist`, splash/background config.
- **`package.json`** — Capacitor dependencies (`@capacitor/core`, `/android`, `/ios`, `/app`, `/cli`, `/assets`) and helper scripts (`cap:build`, `cap:add:android`, `cap:add:ios`, `cap:open:android`, `cap:open:ios`, `cap:assets`).
- **`public/manifest.json`** — the PWA manifest that was missing (name, icons, standalone display, theme color).
- **`index.html`** — added mobile/PWA meta tags (theme-color, iOS standalone, apple-touch-icon).

The parts that **can't** be done in the cloud and must run on your machine: `npm install`, generating the native `android/` and `ios/` projects, and building/submitting — iOS specifically **requires a Mac with Xcode**.

---

## What you need
- **Node.js 18+** on your computer.
- **Android:** [Android Studio](https://developer.android.com/studio) (any OS).
- **iOS:** a **Mac** with **Xcode** (Apple requirement — cannot be done on Windows/Linux).
- **App icon:** one square PNG, **1024×1024**, saved as `assets/icon.png` in the project (Capacitor's asset generator makes all the sized icons from it).
- **Developer accounts:** [Google Play Console](https://play.google.com/console) ($25 one-time), [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).

---

## Step-by-step

### 1. Get the updated repo locally
Pull the repo (which now includes the wrapper files) to your computer or Codespace:
```
git clone https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
cd playearningnexus
```
(For iOS you must do this on a Mac.)

### 2. Install dependencies
```
npm install
```

### 3. Add your app icon, then generate all icon/splash assets
- Put your 1024×1024 icon at `assets/icon.png` (optionally `assets/splash.png` 2732×2732).
- Generate every platform size:
```
npm run cap:assets
```

### 4. Generate the native shells from the wrapper (one command)
```
npm run native:regenerate
```
This builds `dist/`, generates icons, creates the `android/` (and, on a Mac, `ios/`) shells if they don't exist, and syncs everything. The generated folders are git-ignored — you never commit them; just re-run this command whenever you build.

### 5A. Android → Google Play
```
npm run cap:open:android
```
In Android Studio:
1. Let Gradle finish syncing.
2. Set the app version in `android/app/build.gradle` (`versionCode`, `versionName`).
3. **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)** — create a signing key and keep it safe (you need it for every future update).
4. Upload the `.aab` in **Play Console → Create app → Production → Create release**.
5. Fill in store listing, privacy policy URL, content rating, data-safety form → submit for review.

### 5B. iOS → App Store (Mac only)
```
npm run cap:open:ios
```
In Xcode:
1. Select the project → **Signing & Capabilities** → pick your Apple Developer **Team**; confirm the Bundle Identifier (`com.playearningnexus.app`).
2. Set version/build numbers.
3. Choose **Any iOS Device**, then **Product → Archive**.
4. In the Organizer, **Distribute App → App Store Connect → Upload**.
5. In [App Store Connect](https://appstoreconnect.apple.com): create the app, fill in listing, privacy details, screenshots → submit for review.

### 6. Updating the app later
Whenever you change the web app: `npm run cap:build`, then rebuild/re-archive in Android Studio / Xcode and upload a new version. (Because the web build is bundled, content changes ship with an app update. See the "live URL" option below to update content without resubmitting.)

---

## Optional: load the live site instead of bundling (faster content updates)
If you'd rather the app always load your deployed site (so web changes appear without a store resubmission), add this to `capacitor.config.json` and re-sync:
```json
"server": { "url": "https://YOUR-DEPLOYED-DOMAIN", "cleartext": false }
```
Trade-off: Apple review is stricter on apps that are "just a web view," so bundling (the default I set up) is usually the safer route for approval.

## Optional: native push notifications
You already have web push. For native push, add `@capacitor/push-notifications` and wire up **Firebase (FCM)** for Android and **APNs** for iOS. This is a separate setup — do it after the base app is approved.

---

## ⚠️ App Store review reality (read before you submit)
- **Apple Guideline 4.2 ("minimum functionality"):** Apple rejects apps that are just a repackaged website. Your app is feature-rich (games, surveys, referrals, notifications), which helps, but present it as an app, not a website link.
- **Earning / rewards / payments:** Apps where users earn money or make payments get extra scrutiny. Apple generally requires **in-app purchase** for digital goods and has rules about "earn money" incentives; cash-out and real-money features can trigger review pushback. Google has its own rewards/gambling policies. Have your payments and rewards flows reviewed against both stores' current policies before submitting.
- **Skill contests / prizes / money pooling:** the skill-tournament and shared-wallet features may need region gating and clear terms (tie in with `COMPLIANCE-AND-ASSUMPTIONS.md`).
- **Privacy:** both stores require a privacy policy URL and a data-safety / privacy-nutrition-label disclosure. Prepare these first.

---

## Zero-code alternative: PWABuilder
If you'd rather not manage native projects at all, once your PWA is deployed to a public URL:
1. Go to **[pwabuilder.com](https://www.pwabuilder.com)** and enter your deployed URL.
2. It reads your `manifest.json` (now present) and generates a **Google Play package (TWA)** and an **iOS package** for you to submit.
This is the least-effort path for a PWA → stores, though Capacitor (set up above) gives you more native control and a better shot at App Store approval.

---



# App Store Submission Checklist

_Source file: `02 - Mobile Apps/APP-STORE-SUBMISSION-CHECKLIST.md`_

# PlayEarning Nexus — App Store Pre-Submission Checklist

Work top to bottom before you upload to **Google Play** or the **Apple App Store**. Anything marked **BLOCKER** will get your app rejected or delayed if skipped. Companion docs: `MASTER-LAUNCH-GUIDE.md`, `MOBILE-APP-WRAPPER-GUIDE.md`, `LEGAL-PAGES-GUIDE.md`, `COMPLIANCE-AND-ASSUMPTIONS.md`.

Because this app involves **earning money, payouts, referrals, and prize pools**, it gets extra scrutiny from both stores. Budget time for at least one round of review questions.

---

## 1. App identity & assets

- [ ] **Real app icon** — replace the placeholder at `assets/icon.png` with your final 1024×1024 PNG (no transparency, no rounded corners — the stores round it). Then run `npm run cap:assets` to regenerate every size. **BLOCKER** for a professional listing.
- [ ] **Splash screen** (optional) — add `assets/splash.png` (2732×2732) if you want a branded launch screen; re-run `npm run cap:assets`.
- [ ] **App name** confirmed consistent everywhere: `capacitor.config.json`, `public/manifest.json`, store listings.
- [ ] **Bundle/App ID** matches in both stores: `com.playearningnexus.app` (Android `applicationId`, iOS Bundle Identifier).
- [ ] **Version numbers** set: Android `versionCode`/`versionName` in `android/app/build.gradle`; iOS version/build in Xcode.

## 2. Legal pages — BLOCKER for both stores

Both stores require a **live, publicly reachable privacy policy URL** before you can submit.

- [ ] Fill in every `[BRACKET]` placeholder in `PRIVACY-POLICY.md` / `src/pages/PrivacyPolicy.jsx` (company legal name, effective date, contact email, governing state/country).
- [ ] Fill in every `[BRACKET]` placeholder in `TERMS-OF-SERVICE.md` / `src/pages/TermsOfService.jsx`.
- [ ] **Have a lawyer review both** — these are templates, not legal advice, and this app touches money transmission, referrals/endorsements, and prize contests.
- [ ] Confirm the pages are reachable at public URLs on your deployed site (e.g. `https://yourdomain.com/PrivacyPolicy` and `/TermsOfService`).
- [ ] Have those two URLs ready to paste into both store consoles.

## 3. Google Play Data Safety form — BLOCKER

Play requires you to declare what data you collect and why.

- [ ] List every data type collected: account info, email, payment info, device identifiers, approximate/precise location (if used), usage analytics.
- [ ] Declare encryption in transit and whether users can request deletion.
- [ ] Make sure the form matches what the app + your backend actually collect (mismatches get flagged).
- [ ] Complete **Content rating** questionnaire (the earning/contest features affect the rating).
- [ ] Complete the **Financial features** declaration if prompted (payments, "earn real money").

## 4. Apple privacy "nutrition label" + review notes — BLOCKER

- [ ] Fill in **App Privacy** details in App Store Connect (mirrors the Play Data Safety answers).
- [ ] Write **App Review notes**: explain how earning works, that payouts go through Stripe/PayPal, and that contests are **skill/merit-based, not gambling** (reference your compliance doc). This heads off the most common rejection questions.
- [ ] Provide a **demo account** (test login) so reviewers can see the earning/referral flows without signing up.

## 5. Payments & rewards policy review — BLOCKER (highest-risk area)

This is where earn-money apps most often get rejected. Review your flows against **current** store policies before submitting.

- [ ] **Apple Guideline 3.1 (In-App Purchase):** if you sell any *digital* goods/credit, Apple generally requires IAP. Cash-out of *real* earned money is different — make the distinction explicit in review notes.
- [ ] **Apple Guideline 4.2 (minimum functionality):** present as a real app (games, surveys, referrals), not a repackaged website.
- [ ] **Google Play real-money / rewards policies:** confirm the prize pool and referral rewards comply; keep them **skill/merit-based** per `COMPLIANCE-AND-ASSUMPTIONS.md`.
- [ ] **FTC #ad disclosure** is enforced on referral posts (already wired in code) — keep it, reviewers may check.
- [ ] **Region gating:** decide which regions the earning/prize/shared-wallet features are available in, and gate accordingly (money-transmitter and sweepstakes laws vary by state/country).
- [ ] Confirm **payout provider terms** (Stripe/PayPal) allow your payout model.

## 6. Store listing content

- [ ] Screenshots for required device sizes (Play: phone + optional tablet; Apple: 6.7" and 5.5" iPhone at minimum, iPad if you support it).
- [ ] Feature graphic (Play, 1024×500).
- [ ] Title, short description, full description — describe it as an app; avoid over-promising earnings (both stores dislike "get rich" claims).
- [ ] Category, contact email, support URL, marketing URL (optional).
- [ ] Keywords (Apple).

## 7. Technical / build

- [ ] `npm run native:regenerate` completes cleanly (builds `dist/`, generates icons, creates/syncs `android/` and, on a Mac, `ios/`).
- [ ] Android **signed** `.aab` produced via Android Studio — **save the signing keystore somewhere safe; you need it for every future update.** Losing it means you can't update the app. **BLOCKER** if lost later.
- [ ] iOS archive built and uploaded via Xcode (Mac only), with a valid Apple Developer **Team** selected under Signing & Capabilities.
- [ ] Test on a **real device** (not just simulator): sign-in, a survey completion + reward, a payout request, push notification, deep links.
- [ ] Confirm the app points at your **production** backend, not a dev/test environment.

## 8. Accounts & fees (have these ready)

- [ ] **Google Play Console** account — $25 one-time.
- [ ] **Apple Developer Program** — $99/year (required even to submit).
- [ ] Payout/tax info completed in both consoles if you'll ever charge or receive money through the stores.

---

## Recommended submission order
1. Finish icon + legal pages + deploy site (so the privacy URL is live).
2. Complete Data Safety / App Privacy forms.
3. Build signed Android `.aab` → submit to Play (usually faster review).
4. Build iOS archive → submit to App Store with detailed review notes + demo account.
5. Respond quickly to any reviewer questions — for earn-money apps, expect at least one.

> None of this is legal advice. The money, referral, and contest features specifically warrant a lawyer's sign-off before you go live.

---



# Legal Pages Guide

_Source file: `03 - Legal & Compliance/LEGAL-PAGES-GUIDE.md`_

# Privacy Policy & Terms — Setup & Usage Guide

## What was added to the app
- **In-app pages (live in the PWA):**
  - Privacy Policy → route **`/PrivacyPolicy`** (`src/pages/PrivacyPolicy.jsx`)
  - Terms of Service → route **`/TermsOfService`** (`src/pages/TermsOfService.jsx`)
  - Both are **public** (render without login) so app-store reviewers and users can always reach them.
  - Linked in the app's side navigation (Account section) and cross-linked to each other.
- **Standalone documents:** `PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md` (same content, for your records / website).
- **App icons:** `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, and `assets/icon.png` (1024, source for native builds). These are **placeholders** — swap in your real brand icon and re-run `npm run cap:assets`.

## ⚠️ Important: these are TEMPLATES, not final legal documents
They are tailored to this app (surveys, earnings, referrals, skill contests, wallet groups) but **must be reviewed by a lawyer** before launch. This is not legal advice.

## What you must fill in (search for these placeholders)
- `[EFFECTIVE DATE]`
- `[COMPANY LEGAL NAME]`
- `[privacy@yourdomain.com]` / `[support@yourdomain.com]`
- `[ADDRESS]`
- `[STATE/COUNTRY]` (governing law)
- The dispute-resolution/arbitration clause in the Terms (per counsel)

Edit them in **both** places so the app pages and the standalone docs match:
- `src/pages/PrivacyPolicy.jsx` and `src/pages/TermsOfService.jsx` (constants near the top)
- `PRIVACY-POLICY.md` and `TERMS-OF-SERVICE.md`

## App-store / legal requirements these satisfy
- Google Play and the App Store both require a **publicly accessible Privacy Policy URL** — use `https://YOUR-DOMAIN/PrivacyPolicy`.
- Link both pages from your sign-up screen and footer.
- Complete the store **data-safety (Play)** and **privacy nutrition label (App Store)** forms to match this policy.
- Pair with `COMPLIANCE-AND-ASSUMPTIONS.md` for the deeper items (GDPR/CCPA consent capture, contest rules, money-transmitter review).

## Recommended next steps
1. Fill placeholders + legal review.
2. Add a consent checkbox linking these pages at sign-up.
3. Add a cookie/consent banner if serving EEA/UK users.
4. Publish official contest rules for the skill prize pool and feature votes.

---



# Compliance & Assumptions

_Source file: `03 - Legal & Compliance/COMPLIANCE-AND-ASSUMPTIONS.md`_

# Assumptions Reviewed & Corrected — Profitability, Legality, Ethics, Best Practice

You asked me to revisit the assumptions I baked in and correct the ones that don't hold up. Here is every material assumption, the problem with it, and the change I made. Corrections are implemented in code unless marked **Flag** (needs your/your lawyer's decision).

## 1. "Mandatory" weekly survey & referral posting  → changed to OPT-IN
- **Problem.** Forcing users to complete surveys or post ads to their personal accounts — and penalizing them (lockouts, charging missed days) — risks unfair/deceptive-practice claims (FTC Act, state consumer law), and is coercive.
- **Profitability.** Coercion drives churn, complaints, chargebacks, and app-store/pay-processor scrutiny; voluntary + well-incentivized participation retains users and performs better.
- **Corrected.** `is_mandatory` now defaults **false** on `FeatureVoteSurvey` and `WeeklyReferralCampaign`; generators set it false; UI/notification copy changed from "required" to "optional challenge." Incentives (the $0.10, streaks, leaderboards) stay; penalties don't.

## 2. Auto-posting to users' social accounts  → only with explicit consent
- **Problem.** Automatically posting to a user's personal Twitter/Instagram/etc. is against those platforms' Terms of Service unless done through authorized OAuth with the user's opt-in, and mass-identical posts trigger spam / "inauthentic behavior" bans.
- **Legality/best practice.** Platform ToS + CAN-SPAM; risks the user's account **and** your API access.
- **Corrected.** The new daily automation (`autoReferralContestDaily`) auto-posts **only** for users with an active OAuth `SocialMediaConnection`, `auto_posting_enabled`, and an accepted agreement (`accepted_ula`) — mirroring your existing `autoSocialPostingAndTracking` — and respects the 12-hour rate limit and per-user unique copy. Everyone else gets an **optional reminder**; nothing is posted on their behalf.

## 3. Referral/affiliate posts without disclosure  → FTC disclosure enforced
- **Problem.** Paid/incentivized endorsements must disclose the material connection (FTC Endorsement Guides). Undisclosed affiliate posts are illegal.
- **Corrected.** `WeeklyReferralCampaign` now carries `requires_disclosure` (true) and `disclosure_text` ("#ad"); auto-posts pass the disclosure through; UI reminds users to include #ad.

## 4. "$0.10 held pending until next survey"  → fair, never forfeited
- **Problem.** Indefinitely withholding money a user already earned, contingent on more labor, can be an unfair practice.
- **Corrected.** Kept the "credited on next survey" incentive, but added a **grace-period sweep** (`creditPendingReferralPostRewards` with `grace_days`, run daily) that auto-credits rewards pending longer than 30 days regardless. Earned money is always eventually paid.

## 5. "Miss a week → doubled posting requirement"  → positive nudge, not a penalty
- **Problem.** Forcing extra labor as punishment is coercive.
- **Corrected.** Reframed as an **optional double bonus** on the user's best-performing platform (still data-driven from `UserPlatformStats`); it is never required and nothing is penalized. Copy updated.

## 6. AI auto-creating games / features / services  → human + legal review gate (already in place, reaffirmed)
- **Problem.** AI-generated games can infringe third-party IP; AI-generated "services" may be regulated (e.g., anything financial). Auto-shipping is risky.
- **Best practice.** The ecosystem engine **generates specs and queues**; anything in `human_review_categories` (payments, auth, payouts, security) always requires human approval, and IP/quality review should precede publishing any generated game/service.

## 7. Gambling (random jackpot) → skill-based tournament
- **Problem.** `processWeeklyJackpot` chose a winner by **weighted random draw** (`Math.random()`) — a lottery/raffle. Random prize + (any) consideration = gambling, which is heavily regulated/often illegal without a license.
- **Corrected — now a skill-based tournament with an entry fee and a prize pool:**
  - Winner selection rewritten to **rank participants by performance score** (referral points earned) and split the prize pool among the **top finishers** (50/30/20 for top 3). **All randomness removed.**
  - **Entry fee → prize pool:** new `enterSkillTournament` function charges an optional entry fee (from balance) that funds the pool; `prize_pool = platform contribution + collected entry fees`.
  - `ReferralJackpot` entity reframed with `is_skill_based`, `ranking_metric`, `entry_fee`, `prize_pool`, `payout_places`, and a `winners[]` results array. (Entity name kept for compatibility across 54 files.)
  - UI de-gambled: "Win Chance %" and "Your Chances" → "Point Share" / "Ranked By: Skill"; "Active Jackpot" → "Active Skill Tournament"; copy now says winners are decided by skill, not luck.
- **Note.** Skill-based contests with entry fees are legal in most places under the "skill" exemption, but a few U.S. states still restrict them and treat some as gambling. Publish official rules and have counsel confirm eligibility by state before charging entry fees. (Added to flags below.)

### 7a. Refined into an OPEN, MERIT-BASED, self-funding referral reward
Per your point — rewarding people for the referrals they actually drive is a **performance program, not gambling**: everyone gets the same open opportunity, and results track ability. Implemented so it is ethical, legal, **and** margin-accretive:
- **Open to all, no barrier.** Every user earns from their own referrals with no entry fee required (`open_to_all: true`; the optional entry fee defaults to 0 and only feeds an optional competitive top-up).
- **Paid by results, proportional to contribution.** 70% of the pool is distributed **proportionally to each participant's verified contribution** (everyone who drives real referrals earns a share); 30% is a **top-3 bonus** for the leaders. No chance anywhere.
- **Quality-gated (anti-fraud).** Only **verified, converting** referrals count — raw sign-ups that don't convert earn nothing, so you never pay for fake/low-value signups.
- **Self-funding → adds to the bottom line.** The pool is a **share (default 40%) of the actual revenue those referrals generated**; the platform keeps the remaining ~60% as margin. You only ever pay out a fraction of money the program already brought in, so it is structurally net-positive rather than "giving away 10% of profits."
- **Legally, this is standard performance/affiliate marketing** (commission for driving real customers) — not a contest of chance. Keep clear public terms and honor the affiliate/FTC disclosure rules already added.

## Flags — decisions that need you (not code I should silently change)
- **Multi-level referral commissions (MLM).** Your app already has an MLM structure. Reward programs that pay primarily for *recruitment* rather than real product value can cross into illegal pyramid-scheme territory (FTC). **Have counsel confirm** commissions are tied to genuine sales/usage, with clear earnings disclosures. I did not alter the MLM logic.
- **Paying for reviews/votes.** Paying users to post or to vote can bias outcomes and, for reviews, may violate FTC rules on incentivized reviews. Keep it to *feedback/feature preference*, disclose incentives, and don't pay for public product reviews without disclosure.
- **Data privacy.** Collecting demographics (`RespondentProfile`), external company survey data, and "all available data" for AI must comply with GDPR/CCPA: consent, purpose limitation, opt-out, and honoring the survey providers' (e.g., BitLabs) terms. Add a privacy policy + consent capture if not already present.
- **Sweepstakes/contest law.** "Contests" with prizes can trigger sweepstakes regulations (no purchase necessary, official rules, eligibility, tax reporting for winners). Publish official rules for the referral/feature contests.
- **Earnings/withdrawal & tax.** Paying users cash implies 1099 reporting thresholds and money-transmission considerations — confirm your payout provider setup covers these.
- **Shared wallet groups / money pooling.** Letting users pool funds and transfer to each other can trigger **money-transmitter / escrow / stored-value** licensing (state MTL, FinCEN, and equivalents abroad). To reduce risk, the shared-wallet feature I built moves **closed-loop platform credits** (redeemable on-platform), not external cash — closed-loop stored value is generally lower-risk than open money transmission. Before allowing real cash contributions, cash-out of pooled funds, or transfers that function like remittance, have counsel confirm licensing, add group terms, KYC where required, and contribution/withdrawal limits. Group spend is owner-approved and capped by the pool balance by design.

## What I changed in code this round
- the `WeeklyReferralCampaign` table (`backend/db/schema.sql`) — `is_mandatory` default false; added `requires_disclosure`, `disclosure_text`.
- the `FeatureVoteSurvey` table (`backend/db/schema.sql`) — `is_mandatory` default false.
- `backend/functions/generateWeeklyReferralCampaign/entry.ts` — opt-in + disclosure; non-coercive copy.
- `backend/functions/generateWeeklyFeatureVoteSurvey/entry.ts` — opt-in; non-coercive copy.
- `backend/functions/creditPendingReferralPostRewards/entry.ts` — added grace-period fair-crediting across users.
- `backend/functions/autoReferralContestDaily/entry.ts` — **NEW** daily end-to-end automation with all guardrails.
- `backend/agents-runtime/agents.json` (agent `weekly_referral_campaign_agent`) — now daily + compliance rules.
- `src/pages/WeeklyReferralContest.jsx`, `src/pages/WeeklyFeatureVote.jsx` — opt-in + #ad disclosure copy.

---



# How Base44 Was Removed (Architecture)

_Source file: `04 - Architecture & Migration/DE-BASE44-REWORK.md`_

# PlayEarning Nexus — Base44 removal (rework summary)

The codebase has been reworked to **no longer use Base44** while keeping the same functionality. The app now runs on a self-hosted stack: a React frontend talking to a self-hosted backend (`/backend`) instead of the Base44 platform.

## What changed (frontend)
- **`src/api/base44Client.js`** — rewritten. No longer imports `@base44/sdk`; it's now a thin client that calls the self-hosted backend over HTTP. It still exports the same `base44` object with the same surface (`entities`, `auth`, `functions`, `integrations.Core`), so **all 643 files that use it are unchanged**.
- **`src/lib/AuthContext.jsx`** — rewritten. Removed the direct `@base44/sdk` axios import and the Base44 "app public settings" call; auth is now token-based against the backend (`auth.me()` when a token exists).
- **`src/lib/app-params.js`** — removed (Base44 URL/token param plumbing no longer needed).
- **`vite.config.js`** — removed the `@base44/vite-plugin`.
- **`package.json`** — removed `@base44/sdk` and `@base44/vite-plugin`; renamed to `playearning-nexus`.
- **`index.html`** — replaced the Base44 favicon URL with the local app icon.
- **`package-lock.json`** — deleted (regenerates clean, Base44-free, on `npm install`).
- **`.env.example`** — added; the frontend now needs only `VITE_NEXUS_API_URL` (your backend URL).

Result: **zero `@base44` imports anywhere in the running app.** Every feature keeps working because the call sites never changed — only what the `base44` client points at.

## Restored auth flow + lost functionality (added back)
Base44 previously hosted the login screen and file uploads. The self-hosted app now includes:
- **Login/signup pages** — `src/pages/Login.jsx`, `src/pages/Signup.jsx`, and the shared `src/components/auth/AuthForm.jsx`. Routed at `/login` and `/signup` as **public** routes (rendered outside the auth gate so there's no redirect loop). They call `base44.auth.login()` / `signup()`, store the JWT, and return the user to the `?redirect=` target. `redirectToLogin()` / `logout()` land here.
- **`UploadFile` restored to one call** — the client's `integrations.Core.UploadFile({ file })` again returns `{ file_url }`: it requests a presigned S3 URL from the backend, PUTs the bytes, and returns the URL — so the 35 existing upload call sites keep working unchanged (needs `S3_BUCKET` configured on the backend).
- Everything else the SDK exposed (`auth.me`, `auth.updateMe`, `InvokeLLM`, `SendEmail`, `GenerateImage`, `GenerateSpeech`, entity CRUD, `functions.invoke`) is preserved by the client + backend routes.

## Password reset + Google sign-in (added)
- **Password reset** — backend endpoints `/auth/request-reset` (emails a time-limited token link via `SendEmail`) and `/auth/reset-password` (verifies the token, sets the new password). Frontend pages `src/pages/ForgotPassword.jsx` (`/forgot-password`) and `src/pages/ResetPassword.jsx` (`/reset-password`), plus a "Forgot password?" link on the login form. Token is hashed at rest, expires after `RESET_TOKEN_TTL_MIN` (default 60), and never reveals whether an email is registered. Env: `FRONTEND_URL`, `RESET_TOKEN_TTL_MIN`, and a working `SendEmail` provider.
- **Sign in with Google** — backend `/auth/google` verifies the Google ID token (server-side via Google's tokeninfo, checks `aud`), finds-or-creates the user, and issues our JWT. Frontend `src/components/auth/GoogleSignInButton.jsx` (Google Identity Services) shows on the login/signup form. Env: `VITE_GOOGLE_CLIENT_ID` (frontend) + `GOOGLE_CLIENT_ID` (backend). The button self-hides when not configured, so it's zero-risk until you set it up.

## What changed (backend)
- The former Base44 `base44/` platform folder (entities, functions, agents) is **removed** — it's fully superseded by **`/backend`**, the self-hosted equivalent:
  - `backend/functions/` — all 526 functions, converted to the self-hosted SDK.
  - `backend/db/schema.sql` — 235 tables generated from the old entities (validated against real Postgres).
  - `backend/agents-runtime/` — the 76 agents as an LLM tool-calling runtime.
  - `backend/sdk/` — the drop-in SDK (Postgres, auth, integrations, RLS, queue).
  - `backend/server/` — the HTTP server (functions, entities, integrations, auth, agents).
  - `backend/scheduler/` — cron for the automation functions.
- The only remaining `@base44` strings are in **migration tooling/docs** (`backend/tools/export-from-base44.mjs`, the codemod, the cutover guide) — used *once* to pull your data out of Base44, not at runtime.

## How to run the reworked app
1. **Backend:** `cd backend && cp .env.example .env` (set `OPENAI_API_KEY`, `AUTH_JWT_SECRET`, etc.), then `docker compose up --build`. Loads Postgres + boots all functions.
2. **Frontend:** `cp .env.example .env.local`, set `VITE_NEXUS_API_URL=http://localhost:8000`, then `npm install && npm run dev`.
3. **Migrate data (when ready):** follow `backend/PHASE-4-CUTOVER.md` to export from Base44 and import into Postgres.

## Status / honest notes
- The frontend rework and backend conversion are **mechanically complete and pass syntax checks**. The database layer is **validated against a real PostgreSQL 16** (see `backend/PHASE-2-VALIDATION-RESULTS.md`).
- Not yet run end-to-end as a live system (the Deno backend couldn't boot in the build sandbox). Booting it locally + the smoke test is the remaining validation — `backend/PHASE-2-RUNBOOK.md`.
- Base44-hosted **user passwords** don't export; plan a reset flow on first login (noted in the cutover guide). New signups set their own via `/auth/signup`.
- Your original Base44 definitions remain preserved in your GitHub history and earlier full-codebase exports if you ever need them.

---



# Base44 → Self-Hosted API Map (1:1)

_Source file: `04 - Architecture & Migration/BASE44-TO-SELFHOSTED-MAP.md`_

# Base44 → Self-Hosted: complete 1:1 mapping & coverage proof

A line-referenced mapping of **every** Base44 API the codebase uses to its non-Base44 replacement,
plus an automated coverage check. A literal byte-for-byte "one line ↔ one line" doesn't apply to an
SDK swap (one implementation serves many call sites), so this proves the equivalent: **every Base44
surface used has an exact non-Base44 implementation, and zero surfaces are left unmapped.**

## Automated coverage check (0 gaps)
Enumerated every distinct Base44 method used across `src/` (frontend) and `backend/functions` +
`agents-runtime` (backend), then checked each against the implemented set:

| Area | Distinct surfaces used | Implemented | Unmapped |
|---|---|---|---|
| auth (frontend) | 11 | 11 | 0 |
| auth (backend) | 3 | 3 | 0 |
| integrations.Core (frontend) | 5 | 5 | 0 |
| integrations.Core (backend) | 3 | 3 | 0 |
| entity ops (frontend) | 8 | 8 | 0 |
| entity ops (backend) | 7 | 7 | 0 |
| top-level areas (frontend) | 10 | 10 | 0 |
| **TOTAL UNMAPPED** | | | **0** |

## The one literally-1:1 part — the per-function import swap
Every backend function had exactly one Base44 import line, replaced by exactly one self-hosted line:
```
- import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';   (Base44)
+ import { createClientFromRequest } from "../../sdk/mod.ts";          (self-hosted)
```
**526 functions · 0 still importing @base44 · 526 importing the self-hosted SDK.** (Plus each
`Deno.serve(` → `export default __handler(` so the same handler mounts on our server.)

---

## Entity operations — `base44.entities.<X>.<op>` / `asServiceRole.entities.<X>.<op>`
| Base44 call | Self-hosted implementation |
|---|---|
| `.filter(query, sort, limit)` | FE `src/api/base44Client.js:26` → `POST /entities/:name/filter`; BE `backend/sdk/mod.ts:24` → `db.filter`; route `backend/server/entity-routes.ts:33` |
| `.list(sort, limit)` | FE `:27`; BE `mod.ts:25`; route `entity-routes.ts:34` |
| `.get(id)` | FE `:28`; BE `mod.ts:26`; route `entity-routes.ts:35` |
| `.create(doc)` | FE `:29`; BE `mod.ts:27`; route `entity-routes.ts:40` |
| `.update(id, patch)` | FE `:30`; BE `mod.ts:28`; route `entity-routes.ts:46` |
| `.delete(id)` | FE `:31`; BE `mod.ts:29`; route `entity-routes.ts:50` |
| `.bulkCreate(docs)` | FE `:32`; BE `mod.ts:30`; route `entity-routes.ts:54` |
| `.subscribe(cb)` | FE `:34` (polling fallback; Base44 used websockets) |
Backing query engine: `backend/sdk/db.ts` (JSONB containment + operators + merge-update), validated on live Postgres.

## Auth — `base44.auth.<m>`
| Base44 call | Self-hosted implementation |
|---|---|
| `me()` | FE `base44Client.js:50` → `GET /auth/me`; BE `mod.ts:42`; route `auth-routes.ts:154` |
| `updateMe(patch)` | FE `:51` → `/auth/updateMe`; BE `mod.ts:55`; route `auth-routes.ts:49` |
| `login(email,pw)` | FE `:52` → `/auth/login`; route `auth-routes.ts:39` |
| `signup(...)` | FE `:53` → `/auth/signup`; route `auth-routes.ts:29` |
| `logout()` | FE `:57` (clears JWT + redirects) |
| `redirectToLogin(url)` | FE `:61`; BE `mod.ts:50` |
| `isAuthenticated()` | FE `:68` |
| `requestPasswordReset(email)` | FE `:54` → `/auth/request-reset`; route `auth-routes.ts:61` |
| `resetPassword(...)` | FE `:55` → `/auth/reset-password`; route `auth-routes.ts:89` |
| `googleLogin(idToken)` | FE `:56` → `/auth/google`; route `auth-routes.ts:135` |
| `getToken()` / `setToken()` | FE `:68`+ (localStorage JWT) |
| `asServiceRole.auth.updateUser(id,patch)` | BE `mod.ts:69` → `db.update("User",…)` |

## Integrations — `base44.integrations.Core.<m>`
| Base44 call | Self-hosted implementation |
|---|---|
| `InvokeLLM(args)` | FE `base44Client.js:79` → `/integrations/InvokeLLM`; BE `integrations.ts:31` (OpenAI/Anthropic + rate-limit queue); route `integration-routes.ts:12` |
| `SendEmail(args)` | FE `:80`; BE `integrations.ts:85` (SendGrid/SES/SMTP); route `integration-routes.ts:13` |
| `GenerateImage(args)` | FE `:81`; BE `integrations.ts:109` (OpenAI images); route `integration-routes.ts:14` |
| `GenerateSpeech(args)` | FE `:82`; route `integration-routes.ts:15` (OpenAI TTS) |
| `UploadFile({file})` | FE `:86` (one-call presign+PUT → `{file_url}`); route `integration-routes.ts:16` → S3 (`sdk/aws/s3.ts`) |

## Functions — `base44.functions.invoke(name,payload)`
| Base44 call | Self-hosted implementation |
|---|---|
| `functions.invoke` | FE `base44Client.js:74` → `POST /functions/:name`; BE `mod.ts:73` (in-process dispatch); server mounts all 526 at `backend/server/main.ts` |
| `createClientFromRequest(req)` | `backend/sdk/mod.ts:98` |

## Areas that were missing after removal — now restored (see MISSING-ELEMENTS-RESTORED.md)
| Base44 call | Self-hosted implementation |
|---|---|
| `analytics.track/page/identify` | FE `base44Client.js:100–102` → `POST /analytics` (`extra-routes.ts:16`), `AnalyticsEvent` table |
| `agents.createConversation` | FE `:107` → `POST /agents/conversations` (`extra-routes.ts:32`) |
| `agents.addMessage` | FE `:108` → `POST /agents/conversations/:id/messages` (`extra-routes.ts:49`, runs the agent runtime for the reply) |
| `agents.getMessages` / `subscribeToConversation` | FE `:112` / `:117` → `GET …/messages` (polling) |
| `agents.getWhatsAppConnectURL` | FE `:115` (graceful "unavailable" — no self-hosted channel) |
| `users.inviteUser(email)` | FE `:129` → `POST /auth/invite` (`auth-routes.ts:104`) |
| `appLogs.logUserInApp` | FE `:140` → `POST /applogs` (`extra-routes.ts:24`), `AppLog` table |
| `connectors.connectAppUser` | FE `:135` (graceful stub — no self-hosted equivalent) |

## Behavioral (return-shape) parity — checked, one gap found & fixed
A 1:1 comparison isn't only about method *names* — the old code also depends on Base44's return
*shapes*. Audited each:
| Surface | Base44 shape | Consumed as | Status |
|---|---|---|---|
| `functions.invoke` (frontend) | axios `{ data, status }`, throws on non-2xx | `response.data.<field>` in **58 files** | **Was returning the raw body → FIXED**: now returns `{ data, status }` and throws on non-2xx (`base44Client.js:73`) |
| `functions.invoke` (backend) | direct parsed body | `.data` reads are a *field* in the body (e.g. `result.data`), and siblings read direct (`result.failures`) | Correct as-is — direct body matches |
| `integrations.Core.InvokeLLM` | direct result (string/object) | `setOutput(res)`, `result.<field>` | Correct — client returns direct (unwraps `{result}`) |
| `entities.*` | direct array/object | `const x = await …create(); x.id` | Correct — direct |
| `UploadFile` | `{ file_url }` | `.file_url` (20 sites) | Correct |
| error handling | axios `err` | `err.message` (no `err.response.data` anywhere) | Correct |
| URL access-token capture (app-params) | — | no login flow reads a URL token | Not needed — removed cleanly |
| `appPublicSettings` | `{ id, public_settings }` | **0 external consumers** | Stub is safe |

## Design elements (non-code, verified present)
| Base44 element | Self-hosted replacement |
|---|---|
| Hosted login screen | `src/pages/Login.jsx` + `Signup.jsx` + `components/auth/AuthForm.jsx` (styled, with Google button) |
| Hosted password reset | `src/pages/ForgotPassword.jsx` + `ResetPassword.jsx` |
| Base44 favicon (`base44.com/logo_v2.svg`) | local `/icons/icon-192.png` (`index.html`) |
| `@base44/vite-plugin` (HMR/nav notifiers) | removed from `vite.config.js` (not needed self-hosted) |
| App public-settings gate (`AuthContext`) | token-based auth gate (`src/lib/AuthContext.jsx`) |

## Verdict
Across the whole app, **0 Base44 surfaces are used without a non-Base44 implementation**. The runtime
contains **no `@base44` imports** (only doc comments + the one-time migration/export tooling reference
it). Every entity op, auth method, integration, function invocation, and the previously-missing
areas (analytics, agents, invites, logs) map to an exact self-hosted implementation, referenced above
by file and line.

---



# Features Restored After Migration

_Source file: `04 - Architecture & Migration/MISSING-ELEMENTS-RESTORED.md`_

# Codebase audit — elements missing after Base44 removal (now restored)

I audited the whole app by enumerating **every** SDK surface the code actually calls (frontend `src/`
and backend `backend/functions`, `agents-runtime`) and comparing it against what the self-hosted client
and backend implemented. That surfaced several methods that were *used but not implemented* — i.e. they
would have thrown at runtime. All are now implemented, Base44-free.

## Gaps found and fixed

### Backend (functions would have thrown)
| Surface | Uses | Fix |
|---|---|---|
| `base44.auth.updateMe(patch)` | 13 | Added to the backend SDK auth — updates the current user (balances, prefs, etc.). |
| `base44.asServiceRole.auth.updateUser(id, patch)` | 5 | Added a service-role `auth.updateUser` — updates any user by id (payouts, referral bonuses). |

### Frontend (pages/components would have thrown)
| Surface | Uses | Fix |
|---|---|---|
| `base44.asServiceRole.*` | 39 | Aliased on the frontend to the authenticated user's own client (browser can't hold real service-role; **server-side RLS still applies**). |
| `base44.agents.*` (agent chat) | 7 (2 pages) | Implemented in-app AI agent conversations: `createConversation`, `addMessage`, `getMessages`, `subscribeToConversation` (polling), `getWhatsAppConnectURL` (graceful-unavailable). Backed by new tables + the agent runtime. |
| `base44.analytics.track/page/identify` | 12 | Implemented — posts events to `/analytics`, stored in an `AnalyticsEvent` table. Fails soft (never breaks the UI). |
| `base44.users.inviteUser(email)` | 1 | Implemented — admin `/auth/invite` creates the account and emails a 7-day set-password link. |
| `base44.appLogs.logUserInApp(entry)` | 1 | Implemented — posts to `/applogs`, stored in an `AppLog` table. Fails soft. |
| `base44.connectors.connectAppUser()` | 1 | Graceful stub — returns "not configured" instead of throwing (Base44 connector concept has no self-hosted equivalent). |

### Already covered (verified, no gap)
- All entity ops (`filter/create/update/list/get/delete/bulkCreate`) and `.subscribe` (polling).
- All auth methods (`me`, `updateMe`, `login/signup/logout`, `redirectToLogin`, `isAuthenticated`, reset, Google).
- All integrations (`InvokeLLM`, `SendEmail`, `GenerateImage`, `GenerateSpeech`, `UploadFile`).
- `functions.invoke`.

## New backend pieces added
- **Tables** (in `db/schema.sql`, validated against live Postgres): `AgentConversation`, `AgentMessage`, `AnalyticsEvent`, `AppLog` — now 239 tables total.
- **Routes** (`server/extra-routes.ts`): `/analytics`, `/applogs`, `/agents/conversations`, `/agents/conversations/list`, `/agents/conversations/:id/messages` (GET list + POST — POST runs the agent and persists its reply).
- **`/auth/invite`** (`server/auth-routes.ts`): admin-only user invite.
- **RLS**: `AgentConversation`/`AgentMessage` are owner-scoped; `AnalyticsEvent`/`AppLog` global.

## Validated against live Postgres
- New tables create cleanly (4/4).
- Agent conversation flow: create conversation → add user + assistant messages → list in order ✅
- Analytics event recorded and read back ✅
- User-update paths (`updateMe`/`updateUser` → `db.update` on User) ✅
- Syntax checks: all changed frontend + backend files pass (0 errors).

## Honest notes
- **Agent chat** persists conversations and generates replies via the agent runtime, which needs `OPENAI_API_KEY` to actually answer (structure + persistence work without it; replies need the key).
- **WhatsApp/Telegram agent channels** from Base44 aren't reproduced (no self-hosted equivalent) — `getWhatsAppConnectURL` returns unavailable rather than breaking the UI.
- **Frontend `asServiceRole`** intentionally does **not** grant elevated rights in the browser; those calls run with the signed-in user's permissions under RLS. If a specific admin dashboard needs cross-user data, route it through a backend function (service role) rather than the browser.

---



# Migration Plan (Phased, Reference)

_Source file: `04 - Architecture & Migration/BASE44-MIGRATION-PLAN.md`_

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

---
