# Handwork Template — the ONLY manual steps, fill-in-the-blank

Everything in the product is prebuilt and ON, and setup is automated (`npm run setup`). What's left is the
**handwork** — the things no script can do for you: create accounts, paste keys, click through a host's
dashboard, submit to app stores, get legal sign-off. This is that list, in order, as fill-in-the-blanks.
**Work top to bottom, fill each blank, check each box. When they're all checked, you're live.**

Legend:  🧍 = you (owner)   ·   🛠 = whoever deploys (you or a developer)   ·   🤖 = a script does it

**Time:** ~a few hours of signups + ~1 day of deploy/test (much less if you self-serve).
**Cash to launch:** ~$40 (web + Android) or ~$139 (with iOS). Recurring: hosting ~$5–20/mo; AI/media/email $0.

---

## A. Create accounts & collect keys 🧍  (all FREE unless noted)

Sign up, copy the key/ID into the blank. Leave any FREE-tier one blank to launch on its paid fallback; you
can add it later. (Fastest: run `npm run setup` and paste these when prompted — it writes the file for you.)

| ☐ | Service | Where (free) | What you get | Paste here |
|---|---------|--------------|--------------|-----------|
| ☐ | **Groq** | console.groq.com | All AI + speech-to-text at **$0** | `GROQ_API_KEY = __________` |
| ☐ | **Cloudflare** | dash.cloudflare.com → Workers AI token | Image generation at **$0** | `CLOUDFLARE_ACCOUNT_ID = __________`<br>`CLOUDFLARE_API_TOKEN = __________` |
| ☐ | **Brevo** | brevo.com → SMTP & API | Email, free ~9k/mo | `BREVO_API_KEY = __________` |
| ☐ | **AWS** (optional) | aws.com → IAM user | SES email, Polly voice (free 5M/mo yr 1), S3 uploads | `AWS_ACCESS_KEY_ID = __________`<br>`AWS_SECRET_ACCESS_KEY = __________`<br>`AWS_REGION = __________`  `S3_BUCKET = __________` |
| ☐ | **BitLabs** | dashboard.bitlabs.ai | The launch survey network | `BITLABS_API_KEY = __________` |
| ☐ | **Domain** ($) | any registrar (~$15/yr) | Your web address | `APP_URL = https://__________` |
| ☐ | **Railway** | railway.app | Hosting (backend + Postgres) | account made ☐ |
| ☐ | **Google Play** ($25) | play.google.com/console | Android publishing | account made ☐ |
| ☐ | **Apple** ($99/yr, only if iOS) | developer.apple.com | iOS publishing | account made ☐ |
| ☐ | **PayPal** (when going live on money) | developer.paypal.com | Card checkout + payouts | `PAYPAL_CLIENT_ID = __________`<br>`PAYPAL_SECRET_KEY = __________` |

---

## B. Write the config 🤖  (one command)

- ☐ Run `npm ci`
- ☐ Run **`npm run setup`** — paste the keys from Section A when prompted. It writes `backend/.env`,
  auto-generates the security secret, and sets every provider to its free default.
- ☐ Run **`npm run cost:floor`** — pins EVERY cost lever to its floor (free-tier providers, do-once caching,
  rules-first, right-sized models, revenue offsets ON). Add `--cap 5` to also set a hard $5/day AI spend brake:
  `node deploy-kit/cost-floor.mjs --cap 5`. Nothing is turned off — everything stays ON, just cheapest.
- ☐ Run **`npm run env:check`** — confirms each key works and prints the cost-floor readout.

Only three values are truly required to boot: `DATABASE_URL` (from Railway, Section C), `AUTH_JWT_SECRET`
(auto-generated), `APP_URL` (your domain). Everything else has a working fallback.

**Cost at the floor (already applied by `cost:floor` — nothing to build, just what it pins):**

| Lever | Floor | Effect |
|-------|-------|--------|
| AI + speech-to-text | Groq free tier | all AI + voice transcription at **$0** |
| Image generation | Cloudflare FLUX-schnell, 4 steps | images at **$0**, only top-level tiles imaged |
| Email | Brevo free ~9k/mo (else SES) | **~$0** |
| Voice (TTS) | device voice free; premium only | cost scales only with premium |
| Caching | speech + feed searches + translations cached | repeated output **never re-bills** |
| Models | 8B cheap tier default | 70B only when reasoning is asked for |
| Rules-first | free matcher before AI | easy cases skip AI entirely |
| Shared cache | in-memory (free); Redis optional | no Redis bill until scale needs it |
| Guardrail | `--cap 5` sets a hard $5/day AI brake | no path can exceed it |
| Revenue offsets (ON) | interstitial ad + survey hold + shopping cashback | income that covers the ~$5–20/mo hosting |

Result: **AI/media/email $0/mo** at launch scale; only recurring cost is hosting ~$5–20/mo, itself offset by
the revenue levers. Later, admin → **ProviderAdvisor** flags IF paid volume ever makes an owned GPU cheaper.

---

## C. Hosting & deploy 🛠  (Railway dashboard clicks)

- ☐ New Railway project → **Deploy from GitHub** → pick this repo.
- ☐ Add a **PostgreSQL** service. Copy its connection string → `DATABASE_URL = __________`
- ☐ (Optional) Add a **Redis** service for a shared cache → `REDIS_URL = __________`
- ☐ In the **backend** service → Variables → paste everything from `backend/.env`.
- ☐ In the **frontend** service → Variables → set `VITE_NEXUS_API_URL = https://__________` (your backend URL).
- ☐ Deploy. Backend URL: `__________`  ·  Frontend URL: `__________`

---

## D. Database 🛠  (one command each)

- ☐ `psql "$DATABASE_URL" -f backend/db/schema.sql`   (creates the tables)
- ☐ `psql "$DATABASE_URL" -f backend/db/seed.sql`      (optional starter data)

---

## E. Launch checks 🤖

- ☐ `bash deploy-kit/launch.sh`  — validates keys/build, loads schema, smoke-tests.
- ☐ `BACKEND_URL=<backend url> ADMIN_EMAIL=<you> ADMIN_PASSWORD=<pw> node deploy-kit/go-live.mjs`
  — pre-warms the catalog and prints **GO / NOT YET**.
- ☐ Verdict is **GO**: __________

---

## F. Open the doors 🧍  (the only two decisions that are yours)

- ☐ **Payments** — leave OFF for a closed-loop launch, OR set live Stripe/PayPal keys + flip `card_charging`
  ON (needs a live merchant account **and** counsel sign-off). Decision: __________
- ☐ **Go public** — turn `MAINTENANCE_MODE` **OFF** in the admin panel. Live at: __________

---

## G. Mobile apps 🛠 ⏳  (optional — web works without these)

- ☐ Android: `npm run cap:build` → `npm run cap:open:android` → build a signed AAB → upload to Play Console.
  (See `deploy-kit/ANDROID-SUBMISSION-KIT.md`.) Submitted: __________
- ☐ iOS (only if you took the Apple account): build in the cloud, upload to App Store Connect.
  (See `deploy-kit/IOS-NO-MAC-KIT.md`.) Submitted: __________
- ☐ Set `IOS_LAUNCH=1` in settings if shipping iOS (adds Apple's $99 to the cost estimate).

---

## H. Legal sign-offs 🧍  (in parallel — not deploy time)

Have counsel confirm each before the related feature goes on. The app launches fully closed-loop without
any of these; they gate specific money/edge features only.

- ☐ Legal pages reviewed (Terms, Privacy, Refund) — see `LEGAL-PAGES-GUIDE.md`.
- ☐ **Earn-back / Premium-finance:** the daily requirement is defined as an *attempt* (not a forced
  completion), and the "unearned → Site Cash" conversion is treated as **stored value** (non-expiring +
  disclosure). Sign-off: __________
- ☐ **Cash-out / payments:** live merchant account + partner W-9/1099 + counsel before `cash_out` ON.
- ☐ **SMS marketing:** verifiable TCPA opt-in before SMS marketing ON.
- ☐ **Teen accounts:** parental-consent flow + counsel before `teen_accounts` ON.

---

## I. Flags to leave OFF until their prerequisite lands 🧍

These are OFF **by design** — each is a one-line flip in the admin Compliance Flags panel the day its
prerequisite (above) is real. Not budget cuts, compliance guardrails.

- ☐ `card_charging` → needs live processor + legal
- ☐ `cash_out` → needs live merchant + counsel
- ☐ `p2p_transfers`, `store_credit_purchase` → money-transmission counsel
- ☐ `teen_accounts` → parental consent + counsel
- ☐ SMS marketing → TCPA opt-in
- ☐ earnings projections → FTC earnings-claims review

---

## Done = live

When A–F are checked, the web app is live for real users with the whole AI/media/email layer running at
**$0/mo**. G is optional (mobile). H/I unlock the money/edge features on their own timeline. Re-running
`npm run setup` / `env:check` any time is safe.
