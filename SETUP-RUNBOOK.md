# PlayEarning Nexus — Setup Runbook (API Keys & Deploy)

A one-page checklist to wire up the app. Nothing here is new — every variable below is already referenced in the code. Work top to bottom.

## How the app is split (read this first)
- **Backend** (functions, databases, agents) runs on **Base44**. Its secrets go in **Base44's backend secret manager** — never in the repo. Base44 handles scaling.
- **Frontend** (the React site) is a static build. Its variables are **public, build-time** `VITE_*` values that go in `.env.local` (local) or your host's env settings (Amplify/CloudFront).
- **Rule of thumb:** if it's a *secret* (a "secret key", "auth token", "app secret"), it goes in **Base44**. If it starts with `VITE_`, it's public and goes in the **frontend**.

---

## Step 1 — Frontend variables (public, build-time)
Create `.env.local` in the project root (and set the same values in your host's build env). These are safe to expose in the browser bundle.

| Variable | What it's for | Where to get it |
|---|---|---|
| `VITE_BASE44_APP_ID` | Identifies your Base44 app | Base44 → your app → Settings |
| `VITE_BASE44_APP_BASE_URL` | Production backend URL | Base44 → your app (the `*.base44.app` URL) |
| `VITE_BASE44_FUNCTIONS_VERSION` | Pins the backend functions version | Base44 app settings (optional; leave default if unsure) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe checkout (public key) | Stripe Dashboard → Developers → API keys → **Publishable** key (`pk_live_…`) |
| `VITE_PAYPAL_CLIENT_ID` | PayPal buttons (public client id) | PayPal Developer → Apps & Credentials → **Client ID** |
| `VITE_VAPID_PUBLIC_KEY` | Web push (public key) | Same VAPID key pair as backend (public half) |

Example `.env.local`:
```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_PAYPAL_CLIENT_ID=xxx
VITE_VAPID_PUBLIC_KEY=xxx
```

---

## Step 2 — Backend secrets (set these in Base44, NOT in the repo)
In Base44 → your app → **backend environment / secrets**, add each key below. Values are never committed.

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

## Step 3 — No keys needed for these
These run through Base44's own platform credentials — you do **not** supply keys:
`InvokeLLM`, `GenerateImage`, `GenerateSpeech`, `SendEmail`, `UploadFile` (used by the AI/email/image features).

---

## Step 4 — Publish the backend
In Base44 → your app → **Publish**. This deploys the functions, databases, and agents. (Pushing the repo to the connected Git also syncs the Base44 Builder.)

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
- [ ] Sign-in works (Base44 auth reachable via `VITE_BASE44_APP_BASE_URL`)
- [ ] A Stripe/PayPal test transaction completes
- [ ] A test survey/referral action credits correctly
- [ ] Web push / SMS fire (if used)

> Full key inventory and security notes: `CONFIG-AND-SECRETS.md`. Pre-launch legal items (MLM, data privacy, contest/sweepstakes, money-transmitter): `COMPLIANCE-AND-ASSUMPTIONS.md`.
