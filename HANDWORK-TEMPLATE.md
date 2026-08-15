# Handwork Template — the ONLY manual steps, fill-in-the-blank

Everything in the product is prebuilt and ON, and setup is automated (`npm run setup`). What's left is the
**handwork** — the things no script can do for you: create accounts, paste keys, click through a host's
dashboard, deploy the scheduler, submit to app stores, get legal sign-off, and make the pricing/offer
decisions that are yours. This is that complete list, in order, as fill-in-the-blanks.
**Work top to bottom, fill each blank, check each box. When A–F are checked, you're live.**

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

**Optional — self-host AI to reach $0 even at scale (only if you run your own GPU/CPU box):**

| ☐ | Capability | Set | Paste here |
|---|-----------|-----|-----------|
| ☐ | LLM (vLLM/Ollama/TGI) | `LLM_PROVIDER=self` | `SELF_LLM_URL = __________`  `SELF_LLM_MODEL = __________` |
| ☐ | Speech-to-text (faster-whisper) | `PROVIDER_STT=self` | `SELF_STT_URL = __________` |
| ☐ | Text-to-speech (XTTS/Piper) | `PROVIDER_TTS=self` | `SELF_TTS_URL = __________` |
| ☐ | Image gen (SDXL/FLUX) | `IMAGE_PROVIDER=self` | `SELF_IMAGE_URL = __________` |

Leave all four blank to run on the free hosted tiers (Groq/Cloudflare) — the one-click cost floor prefers your
self endpoints when set, else the free tiers.

---

## B. Write the config 🤖  (one command) + drop cost to the floor

- ☐ Run `npm ci`
- ☐ Run **`npm run setup`** — paste the keys from Section A when prompted. Writes `backend/.env`,
  auto-generates the security secret, and sets every provider to its free default.
- ☐ **Drop cost to the floor** — either run **`npm run cost:floor`** (add `--cap 5` for a hard $5/day AI brake:
  `node deploy-kit/cost-floor.mjs --cap 5`), **or** after deploy click **Setup Wizard → "Drop cost to the
  floor."** Either pins every lever cheapest and flips **`AI_FORCE_CHEAP_TIER`** so *every* AI call runs on the
  small Llama model (dump-everything-into-Llama). Nothing is turned off — just cheapest.
- ☐ Run **`npm run env:check`** — confirms each key works and prints the cost-floor readout.

Only three values are truly required to boot: `DATABASE_URL` (Railway, Section C), `AUTH_JWT_SECRET`
(auto-generated), `APP_URL` (your domain). Everything else has a working fallback.

**Cost at the floor (pinned by `cost:floor` / the wizard button):** AI + speech-to-text → Groq free tier (or
your self endpoint); every LLM call → small Llama (`AI_FORCE_CHEAP_TIER`); image → Cloudflare FLUX free (or
self SDXL/FLUX); TTS → device/Polly free (off ElevenLabs); email → Brevo/SES ~$0; caching on; rules-first
before AI; `AI_DAILY_SPEND_CAP_USD` hard brake. Result: **AI/media/email $0/mo**; only hosting ~$5–20/mo,
offset by the revenue levers (interstitial ad + survey hold + shopping cashback). See `COST-FLOOR-AND-LOW-LEGAL.md`.

---

## C. Hosting & deploy 🛠  (Railway dashboard clicks)

- ☐ New Railway project → **Deploy from GitHub** → pick this repo.
- ☐ Add a **PostgreSQL** service. Copy its connection string → `DATABASE_URL = __________`
- ☐ (Optional) Add a **Redis** service for a shared cache → `REDIS_URL = __________`
- ☐ In the **backend** service → Variables → paste everything from `backend/.env`.
- ☐ In the **frontend** service → Variables → set `VITE_NEXUS_API_URL = https://__________` (backend URL).
- ☐ Deploy. Backend URL: `__________`  ·  Frontend URL: `__________`

---

## D. Database 🛠  (one command each)

- ☐ `psql "$DATABASE_URL" -f backend/db/schema.sql`   (creates the tables — includes all new entities:
  FunnelJourney, FunnelEmailLog, FunnelBenchmark, ProductStat, Tier1FinancedPlan, Tier2ScalingPlan, FlexPayPlan, GoodsAdvance, AdvertiserApplication)
- ☐ `psql "$DATABASE_URL" -f backend/db/seed.sql`      (optional starter data)

---

## E. Scheduler 🛠  (the recurring jobs — deploy this or none of them run)

The daily/automation jobs (catalog seed, AI optimizer, self-learning, **funnel benchmark compile**, **funnel
re-engagement sweep**, **product-stats compile**, loyalty/points reconcile, etc.) run from an always-on
scheduler process, not the web server. Deploy it once:

- ☐ Add a **second Railway service** (or any always-on host) running `deno run --allow-net --allow-env
  --unstable-cron backend/scheduler/main.ts`.
- ☐ Set its env: `BACKEND_URL = https://__________` (your backend), `SCHEDULER_SERVICE_USER_ID = __________`
  (the seed admin id), plus the same `AUTH_JWT_SECRET` as the backend (it signs a service token).
- ☐ Confirm the log prints `Scheduler up — N function jobs …` and the funnel/product jobs appear.
- ☐ (Optional first) The re-engagement sweep ships in **dry-run** (`schedules.json` → `funnel-reengage-sweep-daily`
  has `"body": { "dry_run": true }`). Watch a few runs, then set `dry_run:false` to send for real.

---

## F. Launch checks 🤖  &  open the doors 🧍

- ☐ `bash deploy-kit/launch.sh`  — validates keys/build, loads schema, smoke-tests.
- ☐ `BACKEND_URL=<backend url> ADMIN_EMAIL=<you> ADMIN_PASSWORD=<pw> node deploy-kit/go-live.mjs` — verdict: __________
- ☐ **Go public** — turn `MAINTENANCE_MODE` **OFF** in the admin panel. Live at: __________
- ☐ **Payments** — leave OFF for a closed-loop launch, OR set live Stripe/PayPal + flip `card_charging` ON
  (needs live merchant account **and** counsel). Decision: __________

---

## G. Mobile apps 🛠 ⏳  (optional — web works without these)

- ☐ Android: `npm run cap:build` → `npm run cap:open:android` → signed AAB → Play Console. Submitted: __________
- ☐ iOS (only if you took the Apple account): build in the cloud → App Store Connect. Submitted: __________
- ☐ Set `IOS_LAUNCH=1` in settings if shipping iOS (adds Apple's $99 to the estimate).

---

## H. Monetization & offer decisions 🧍  (set once — all admin-tunable, sensible defaults shipped)

These are yours to confirm/change in the admin Settings panel. Defaults in parentheses.

- ☐ **Tier 1 advertiser price** ($12,000/yr · $1,000/mo upfront): __________
- ☐ **Tier 1 deliverables** (200k impressions/yr, 4-yr term, featured placement, AI creative, ~30 social
  posts/mo, A/B + analytics + sentiment; keep-100% survey window 4 yrs): confirm ☐
- ☐ **Premium gift boost** (up to $2,000 non-cashable store credit — a premium-member benefit from a
  collective advertiser pool, **decoupled from the $12k fee**, claimed by members, subject to availability;
  replaces the old $1,000 credit): confirm ☐
- ☐ **Founding → Tier 2 upgrade discount** (6% off; first year for all, perpetual for founding members): __________
- ☐ **Tier 2 "Scale"** total ($200,000), parts (12 × 30-day), results gate (`TIER2_PART_MIN_RESULTS_MULT`, 0=off): __________
- ☐ **Tier 2 deliverables** (3,000,000 impressions/yr, 100 social posts/mo, 4 audience panels/yr, perk unlock
  ladder `TIER2_PERK_UNLOCKS`): confirm/tune ☐
- ☐ **AI funnel** (`ai_funnel` ON) — product graph (`AI_FUNNEL_PRODUCT_GRAPH`), Gate-2 thresholds, results
  illustration (hypothetical until substantiated): confirm ☐
- ☐ **Benchmark / product-stats sample thresholds** (`AI_FUNNEL_BENCHMARK_MIN_SAMPLE` 30,
  `PRODUCT_STATS_MIN_SAMPLE` 30) — how many real results before a "typical" figure publishes: __________
- ☐ **Earn-to-unlock free advertiser tier** — DISCONTINUED (`FREE_ADVERTISER_TIER_ENABLED` OFF). Leave off unless reviving.
- ☐ **Public `/Apply` page** — live and reachable pre-login; markets Founding Tier 1 (prominent), Tier 2
  (available), and the three credit products as "coming soon." Set `FOUNDING_ADVERTISER_SLOTS` (the "limited
  space" cap) and review the leads it captures (`AdvertiserApplication`). See `APPLY-AND-COMING-SOON.md`. Confirm ☐

---

## I. Email / marketing consent 🧍  (before the AI concierge emails anyone)

- ☐ Set **`BUSINESS_MAILING_ADDRESS`** — your physical postal address (required in every marketing email's
  CAN-SPAM footer). __________
- ☐ Set **`FUNNEL_EMAIL_FROM`** — a real, **monitored** address so replies (the concierge "conversation")
  reach you. __________
- ☐ Confirm marketing consent is captured (`canEmailMarket`: `email_marketing` flag ON + opt-out honored). The
  re-engagement sweep only emails opted-in customers; a raw lead needs an opt-in recorded first.
- ☐ **Jurisdiction note:** CAN-SPAM (US) = opt-out OK for existing contacts; CASL (CA) / GDPR (EU) = opt-IN
  required. Only email those regions with prior consent.

---

## J. Legal sign-offs 🧍  (in parallel — NOT deploy time; app launches fully without any of these)

Have counsel confirm each before its feature goes on. The lowest-legal-cost launch keeps every credit product
OFF and runs on the straightforward, non-credit features (Tier 1 upfront, Tier 2 pay-as-you-go, promotions,
consent-gated marketing) — so your only near-term legal cost is the one item you choose to unlock.
See `COST-FLOOR-AND-LOW-LEGAL.md` + the Lawyer Packet docs.

- ☐ Legal pages reviewed (Terms, Privacy, Refund) — `LEGAL-PAGES-GUIDE.md`.
- ☐ **Flexible Payments (`flexpay`)** — installment credit. Cheapest path: **`self_financed`** (0%,
  4-installment, credit-card) *may* fit the four-installment exemption → needs a **one-time attorney read**,
  no lender. Otherwise a licensed provider. Set `FLEXPAY_PROVIDER` + `FLEXPAY_LEGAL_SIGNOFF=true`. Sign-off: __________
- ☐ **Tier 1 Financed (`tier1_financed`)** — recourse credit ($12k owed). Needs licensed creditor + counsel +
  licensing. Set `TIER1_FINANCED_PROVIDER` + `TIER1_FINANCED_LEGAL_SIGNOFF`. Sign-off: __________
- ☐ **Goods Advance (`goods_advance`)** — non-recourse advance credit. Needs licensed provider + counsel. Set
  `ADVANCE_PROVIDER` + `ADVANCE_LEGAL_SIGNOFF`. Sign-off: __________
- ☐ **Results / earnings claims** — runs compliant at $0: the concierge/product pages show a hypothetical
  "how it works" until real data passes the sample threshold, then auto-publish the substantiated figure with
  its basis. No counsel needed for a hypothetical. Confirm the disclaimer copy: __________
- ☐ **Cash-out / payments:** live merchant + partner W-9/1099 + counsel before `cash_out` ON.
- ☐ **SMS marketing:** verifiable TCPA opt-in before SMS marketing ON.
- ☐ **Teen accounts:** parental-consent flow + counsel before `teen_accounts` ON.

---

## K. Flags to leave OFF until their prerequisite lands 🧍

OFF **by design** — each is a one-line flip in the admin Compliance Flags panel the day its prerequisite is
real. Compliance guardrails, not budget cuts.

- ☐ `flexpay` → licensed provider **or** attorney-confirmed self-financed + `FLEXPAY_LEGAL_SIGNOFF`
- ☐ `tier1_financed` → licensed creditor + counsel + `TIER1_FINANCED_LEGAL_SIGNOFF`
- ☐ `goods_advance` → licensed provider + counsel + `ADVANCE_LEGAL_SIGNOFF`
- ☐ `card_charging` → live processor + legal
- ☐ `cash_out` → live merchant + counsel
- ☐ `p2p_transfers`, `store_credit_purchase` → money-transmission counsel
- ☐ `teen_accounts` → parental consent + counsel
- ☐ SMS marketing → TCPA opt-in

**Already ON and needing NO gate (launch with these):** `ai_funnel`, the public `/Apply` page (markets the
three credit products as "coming soon" while they stay gated), Tier 2 scaling (pay-as-you-go, not credit), the
rollover/upgrade discount, premium gift boost, product-stats + benchmark compilers, and the consent-gated
email re-engagement.

---

## Done = live

When A–F are checked, the web app is live for real users with the whole AI/media/email layer running at
**$0/mo** and the scheduler driving the recurring jobs. G is optional (mobile). H are your offer decisions
(defaults are fine). I gates the AI emails. J/K unlock the money/credit features on their own timeline.
Re-running `npm run setup` / `env:check` / the cost-floor is always safe.
