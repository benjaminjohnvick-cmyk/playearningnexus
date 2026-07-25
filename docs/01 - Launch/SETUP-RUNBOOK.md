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

## Step 3.5 — Pre-deploy validation (run before deploying)
Catch build/type errors **before** they hit production. Best run in a Linux environment (a GitHub Codespace, or your CI) — Windows-on-ARM machines hit native-module issues that don't reflect the real build.

**Frontend build (the main gate):**
```
npm install
npm run build      # must finish with "✓ built in ..." and produce ./dist
```
> If `npm install` fails on `sharp`/`node-gyp` on a Windows-ARM PC, that's an environment quirk, not a code issue — use a Codespace, or `npm install --ignore-scripts`. The build must ultimately pass on Linux (which is where your host builds it).

**Backend typecheck (Deno):**
```
# install Deno once (Linux/Codespace):
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"

cd backend
# core (server + SDK + agent runtime):
deno check server/main.ts sdk/oversight.ts sdk/events.ts sdk/survey-evidence.ts sdk/payout-policy.ts agents-runtime/agent-runtime.ts agents-runtime/guardrails.ts
# money/economy + agent functions:
deno check functions/awardReward/entry.ts functions/spendBalance/entry.ts functions/transferCredit/entry.ts functions/placeStoreOrder/entry.ts functions/purchaseStoreCredit/entry.ts functions/surveyIngest/entry.ts functions/oversightApprove/entry.ts functions/oversightReject/entry.ts functions/oversightPending/entry.ts
```
The first `deno check` downloads remote imports (`npm:stripe`, `deno.land/x/postgres`, etc.) — normal, one-time. No output + clean exit = it typechecks. Any error names the file + line — fix before deploying.

> Note: `deno check server/main.ts` does not follow the functions loaded dynamically at runtime, which is why the money/agent functions are listed explicitly above. The true end-to-end gate is the backend booting and `/health` returning `{"ok":true}` (Step 4).

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
