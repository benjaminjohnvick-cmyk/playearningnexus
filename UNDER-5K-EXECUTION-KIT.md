# Under-$5K Execution Kit — GamerGain / PlayEarning Nexus

> ## ⭐ CURRENT RECONCILED ESTIMATE — 2026-08-03
>
> **All GamerGain launch-cost docs use these figures. Where an older number appears anywhere below, this
> banner supersedes it.** (Reflects everything built through 2026-08-03: the scale flywheels + Services page,
> the opt-in shopping extension, and the one-command cost floor.)
>
> - **Full launch — web PWA + Android + native iOS: ~$2,900–$4,000 year-one all-in.** Developer labor is
>   ~$2,025–$3,075 (≈ 27–41 hours @ $75/hr) — deploy, test, and submit only, because every feature ships
>   prebuilt and ON.
> - **Shoestring — web PWA + Android (iOS as fast-follow): ~$2,000–$2,800.**
> - **Hard external cash floor: ~$139** for all three platforms (Apple $99/yr + Google Play $25 + domain
>   ~$15); **~$40** shoestring (no Apple fee — the PWA covers iPhone via Safari).
> - **Recurring: AI / media / email $0/mo** on free tiers (locked in by `npm run cost:floor`); hosting
>   ~$10–30/mo; LLM capped ~$5–40/mo. **Optional** AWS auto-scaling + full load test adds up to a
>   ~$3,100–$4,800 all-in ceiling.
>
> *Older single figures in these docs (e.g. "$3,750–$4,950" or "under $3,900") predate the kit/automation
> that trimmed the developer hours; the number above is current.*


**Purpose:** get a developer from "code on GitHub" to "live on web + Android + iOS" for **≤ $5,000**
at **$75/hr**. It works by removing the guesswork — every phase below ships with the exact config, copy,
and steps, so the developer runs near the *low* end of the estimate instead of the high end.

**Stack chosen:** Railway (all-in-one) · iOS built in the cloud (no Mac).

**Latest cost floor (2026-07-30):** see `LAUNCH-ESTIMATE-2026-07-30.md` — a web + Android launch with
**everything on from day one** now lands at roughly **$2,000–$2,800 all-in for year one** (developer
labor only ≈ $1,725–$2,475), because every product feature ships prebuilt and the developer only deploys
it. The hard external floor is **~$40** shoestring (Play $25 + domain ~$15) or **~$139** with native iOS
(adds Apple $99/yr). It keeps dropping because there is less hand-work left to do, not because corners
were cut.

---

## Everything is prebuilt and ON from the get-go

There is **no product-build phase left** — the kit's hours are deploy, test, and submit only. Everything
below ships switched **on** by default (a code fact — the built-in feature-flag defaults enable them):

- Marketplace: Physical, Digital, and **Services** — the Services section now has **serverless-GPU
  category tiles + subsections + search, full parity with the App Store and the other sections**.
- Premium PPC + the retail Loyalty/Rewards program, including **auto-qualify → one-tap Premium**: a user
  who hits the daily survey goal on enough days is offered a consent-gated, one-tap upgrade to Premium.
- **Tiered survey rewards** — non-premium earn 12 points per $1 of survey value; premium earn 24% cash
  back; the store unlocks at $8/day of gross survey value.
- **Group goals** — friends work toward a big-ticket item together; each keeps their own points (no shared
  wallet), and the platform funds a capped reward at the shared milestone.
- **Verified surveys** — answer by *typing/dictating* (free, uses the phone keyboard's mic) or by voice
  recording; a free rules-first matcher fills the answers and the respondent confirms. Recordings are
  transcribed then **discarded — never stored**.
- The full AI layer: catalog seeding, the shopping assistant, the optimizer, self-learning, and live
  experiments.
- KYC survey, welcome rewards, Daily/Points Boost, layaway, purchase-payback, referrals (single-tier),
  jackpots, social posting, email, site telemetry, and the UX heatmap.
- **Partner cash-out is on** (regular users stay closed-loop at every rail).

Only six things are held **off**, each for a specific external prerequisite, each a one-line flag flip the
day that prerequisite lands (no redeploy): **card charging** (needs a live processor + legal sign-off),
**Affirm BNPL** (needs merchant keys), **SMS marketing** (needs verifiable TCPA opt-in), **teen accounts**
(needs a parental-consent flow + counsel sign-off), **store-credit purchase / P2P transfers**
(money-transmission risk), and **earnings projections** (FTC earnings-claims risk). These are compliance
guardrails, not budget cuts.

---

## New this session (2026-07-30) — what to set & verify

**New env vars.**

- `OPENAI_API_KEY` — powers the verified-survey **Whisper fallback** transcription, the voice/text answer
  autofill, the AI "valid response" score, and the rest of the AI layer. Everything **degrades gracefully
  without it**: "type or speak" still works (the phone keyboard dictates for free), autofill falls back to
  the free rules matcher, and features stay on — but set it for full function.
- Optional cost flips (each a no-op until set; see `COST-LEVERS-CODEABLE.md`): `REDIS_URL` (shared cache
  for the do-once translation + geo-IP lookups), `DATABASE_REPLICA_URL` (offload all DB reads),
  `IMAGE_PROVIDER=aws_bedrock` (cheapest image tier — images are one-time anyway), and
  `CLAUDE_MODEL_DEFAULT` (only if you run the Anthropic provider and want to override the cheap default).

**New DB entities — `AUTO_MIGRATE=1` creates them on boot** (already in the runbook): `GroupGoal`,
`GroupGoalReward`, `VerifiedSurveyMedia`. They're in `backend/db/entities.json` + `schema.sql` +
`rls-policy.json`; confirm the tables exist after the first deploy.

**New scheduled job** (runs under the inline scheduler — no cron wiring): `aiServiceCategoryImages` —
generates the Services category tiles once, then no-ops. (Tiles show a gradient placeholder until it runs,
or trigger it once from admin.)

**Smoke-test after deploy** (all on by default): tiered survey rewards + $8/day store unlock; the Services
section tiles + search; the earned-Premium banner (appears after the survey-day milestone); group goals
(create → share code → summed progress → claim reward); verified surveys — "Type or speak" (no key needed)
and "Record my voice" (Whisper fallback needs `OPENAI_API_KEY`; device dictation is free). See
`VERIFIED-SURVEYS.md`.

**New admin settings (safe defaults; tune in the panel):** `SURVEY_POINTS_PER_DOLLAR` (12),
`SURVEY_PREMIUM_CASHBACK_PCT` (0.24), `SURVEY_DAILY_GOAL_USD` (8), `PREMIUM_AUTOQUALIFY_DAYS` (260),
`GROUP_GOAL_DISCOUNT_PCT` (0.10) / `GROUP_GOAL_REWARD_CAP_USD` (100), `VERIFIED_SURVEY_MIN_VALIDITY` (50),
`AUTOFILL_MATCH_MIN_CONFIDENCE` (0.5), and `MODERATION_BLOCK_TERMS` (empty — add any clear-cut banned
terms; nuanced hate-speech judgement still routes to the AI).

**Cost posture is already applied in code** (no action needed): cheap-model default, rules-first
moderation/triage, borderline-only AI quality scan, do-once translation cache, geo-IP cache, and
verified-survey recordings never stored. The only cost knobs left are the optional env flips above.

---

## The number

| Phase | Hours (with this kit) | The file that cuts it |
|---|---:|---|
| Accounts & API keys (owner-run, not billable) | 0 | `API-KEYS-WORKSHEET.md` |
| Deploy backend + Postgres + scheduler + frontend (one service) | 5–7 | `railway/RAILWAY-DEPLOY.md` + `railway/*.json` |
| Pre-deploy validation | 1 | `validate.sh` |
| Configure AI / catalog / turn features on | 1–2 | env + flags only (all prebuilt) |
| Survey / earn-loop live test | 3–5 | `seed-demo` + `e2e-smoke` |
| QA pass | 5–7 | `QA-CHECKLIST.md` |
| Android submission (signed .aab) | 8–11 | `ANDROID-SUBMISSION-KIT.md` + fastlane |
| **Subtotal — PWA + Android** | **~23–33** | **≈ $1,725–$2,475** |
| iOS submission (cloud CI, no Mac) | +4–8 | `IOS-NO-MAC-KIT.md` + `ci/` |
| **Total — PWA + Android + iOS** | **~27–41** | **≈ $2,025–$3,075** |

**Bottom line:** PWA + Android lands at **~$1,725–$2,475**; adding iOS via cloud CI keeps the full
three-platform build around **$2,025–$3,075** — comfortably under $5k. The only thing that pushes it up is
an Apple review rejection round (common for earn-money apps), so treat that as the single budget risk.
There is no Mac purchase and no product-build hours, because the product is already built.

> These are targets, not guarantees. The kit removes *discovery and rework* — the biggest causes of the
> high-end blowout. Keep iOS review clean (demo login, "not gambling" framing) to protect the number.

---

## Order of operations (hand this whole folder to the developer)

1. **Owner first:** fill in `API-KEYS-WORKSHEET.md` (account signups are not billable dev work). Set at
   least `OPENAI_API_KEY` for the full AI/verified-survey feature set.
2. `bash deploy-kit/validate.sh` — prove the build is green before touching the cloud.
3. **Railway:** follow `railway/RAILWAY-DEPLOY.md` → Postgres, backend, scheduler, frontend live. Confirm
   `AUTO_MIGRATE=1` created the new entities (GroupGoal, GroupGoalReward, VerifiedSurveyMedia).
4. **Turn it all on:** features are on by default; confirm the flag posture in the admin panel.
5. **Money & loop:** run `PAYMENTS-TEST-CHECKLIST.md` then `SURVEY-LOOP-TEST.md` / `e2e-smoke`.
6. **QA:** run `QA-CHECKLIST.md` on the live app, plus this session's features — Premium banner, Services
   tiles, group goals, tiered rewards, and both verified-survey paths (type-or-speak + record).
7. **Android:** `ANDROID-SUBMISSION-KIT.md` → signed `.aab` → Play Console.
8. **iOS (no Mac):** `IOS-NO-MAC-KIT.md` → Codemagic (`ci/codemagic.yaml`) or GitHub Actions.

## What is NOT in the number (unavoidable, not "development")
- Apple Developer **$99/yr** (only if you ship native iOS) · Google Play **$25** one-time · domain **~$12–15/yr**.
- Monthly hosting: Railway at launch traffic **~$10–30/mo**; provider/LLM usage on top (usage-based, capped
  by `AI_DAILY_SPEND_CAP_USD`, and now much lower thanks to the applied cost levers).
- Category images one-time **~$11–19** (retail + app + ~18 Services tiles ≈ $2–4); generated once, reused
  for the life of the store.
- Optional lawyer review of Privacy/Terms (templates provided; sign-off is the cost).

## How to protect the budget (owner playbook)
- Do the **account signups yourself** — never pay dev hours for forms.
- Insist on **`validate.sh` before any cloud work** — it kills the #1 surprise.
- Ship **Android + iOS via CI** — no Mac purchase, no per-platform rewrite.
- Launch **web + Android now, iOS as a fast-follow** — iPhone users still get the PWA on Safari day one,
  and adding native iOS later is a flip, not a rebuild.
- Keep the **iOS review clean** (demo login, merit-not-gambling framing) to avoid rejection-round hours.
- **Runtime stays cheap by default** — the cost levers are applied in code; flip `REDIS_URL` /
  `DATABASE_REPLICA_URL` only when a load test says you need them (`COST-LEVERS-CODEABLE.md`).

## Also shipped & ON (latest session — all prebuilt, deploy-only)

Every item below ships switched **on** by default (flag/setting defaults enforce it) — no build phase, the
developer only deploys and tests:

- **Economics:** no customer markup for anyone; **50/50 survey split** (users accrue 50% as non-cashable
  points); **12%/24%-of-balance per-transaction spend cap**; PPC AdGrid **$12,000**; double-ROI free-social
  guarantee **$16,000**; referral **300-point** activation bonus + 10% single-level override.
- **Premium tier scale-up:** earned upgrade (survey-days **+ 3 referrals**) → one-tap opt-in + affiliate;
  **free founding cohort** so premium revenue starts day one.
- **Daily commitment nudge** (pick-a-time reminder + streaks, App-Store-safe) · **AdGrid PPC engine**
  (16-thumbnail / 2-question flow, Option E, auto-wishlist, per-user answer profile, end-of-session links).
- **Marketplace uniformity:** one section navbar + Amazon-style cards across all sections; App Store parity.
- **Seller storefronts** (one-click, keep 100% + 10% back; curated catalog resale) · **affiliate referral
  rewards** · **Growth Engine + redemption reserve** (admin) · **Profit page**.
- **Payments & checkout:** live **PayPal API** wiring (`PAYPAL-SETUP.md`); opt-in **"Apply points"** button
  on every checkout; **hybrid card+points** (points funded via PayPal).
- **AI Shopping Assistant + 7 sanctioned sourcing channels** (`SOURCING-AND-FULFILLMENT.md`): dropship
  (full AI auto), affiliate hand-off, product feeds, gift-card rail, wholesale/supplier registry, and a
  manual **Buying Desk** fallback.
- **Setup Wizard** (admin page + `setupStatus`): a live go-live checklist of what's connected/on and the
  exact next step for anything that isn't.

## Go-live: the only remaining work is connecting YOUR accounts

Everything above is code-complete and on. Open the **Setup Wizard** (admin) — it turns green as you connect
each of these (none is billable dev work):

1. **AI key** — `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`): powers the assistant, moderation, and voice
   surveys. *(cheap model tier by default)*
2. **PayPal** — `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` (sandbox → live) + turn on `card_charging`
   (`PAYPAL-SETUP.md`). All money routes through your PayPal business account.
3. **Product feed** — `PRODUCT_FEED_API_BASE` / `PRODUCT_FEED_API_KEY` + `AFFILIATE_TAG`: lets the assistant
   search everywhere (else it searches your own catalog).
4. **Dropship supplier(s)** — `registerSupplier` + its key env var: flips those SKUs to full-auto fulfillment
   (unconnected orders fall back to the Buying Desk automatically).
5. **Gift-card stock** — `giftCardStockAdd` (optional): powers the points→gift-card rail.

## Cost at the floor (applied in code, everything still on)

**One command pins every lever:** `npm run cost:floor` (or `node deploy-kit/cost-floor.mjs --cap 5` to also set
a hard $5/day AI spend brake). It writes the floor values into `backend/.env`, prints the full readout, and is
safe to re-run. Nothing is turned off — everything stays ON, just at its cheapest path. The levers it pins:

- **All AI calls use the cheap model tier** (8B `llama-3.1-8b-instant` by default; 70B only when reasoning is
  explicitly requested via `model:"gpt_5"`).
- **Rules-first before AI** — a free rules matcher (`AUTOFILL_MATCH_MIN_CONFIDENCE`) resolves the easy survey
  answers so they skip the AI entirely; anti-scam + answer-wall are pure regex (zero AI).
- **Do-once caching** on translations, **product-feed searches** (`PRODUCT_FEED_CACHE_TTL_S`, 1h), and
  **synthesized speech** (`TTS_CACHE_ENABLED`, 30-day) so repeated output never re-bills.
- **Right-sized images** — Cloudflare FLUX-schnell at **4 steps**; only top-level Service tiles get a GPU image
  (`SERVICE_SUBCATEGORY_IMAGES=0`), not every subsection.
- **In-memory cache by default** — no Redis bill; add `REDIS_URL` only when a load test says you need a shared
  cache. AdGrid ad copy is advertiser-written by default; AI generation is opt-in per ad.
- **Per-feature cost governors** — Points Boost daily/lifetime caps (`BOOST_DAILY_CAP_USD`,
  `BOOST_LIFETIME_CAP_USD`), session-capture analysis budget (`SESSION_CAPTURE_DAILY_BUDGET_USD`), and the
  global hard brake **`AI_DAILY_SPEND_CAP_USD`** — set it and no path can exceed it.
- **Self-host advisor** (admin → ProviderAdvisor) meters real hosted spend and flags IF/when an owned GPU
  ever beats the free/paid tiers — so you only self-host when the math says to, never speculatively.
- Nothing is turned off to save money; the floor comes from free tiers + caching + rules-first + right-sizing.

**Revenue offsets that fund the floor (ON from day one):** three levers generate income that covers the small
hosting bill, pushing *net* cost toward zero as usage grows — the **30-second interstitial ad** between surveys
(non-premium, your own inventory → your ad revenue), the **marketplace-equivalent survey hold** (an equal % of
gross survey revenue, since you hold no inventory), and the opt-in **shopping-extension affiliate cashback**
(your share of commission on purchases anywhere). See `SCALE-TO-AMAZON-STRATEGY.md` +
`SHOPPING-EXTENSION-AND-SERVICES.md`.

**NEW — one-click floor, in the app.** Beyond the deploy-time script, admins can now drop cost to the floor
live from the **Setup Wizard** ("Drop cost to the floor" button) or the `costFloorProfile` function. It routes
every capability to the cheapest backend — your **self-hosted server if a `SELF_*_URL` is set, otherwise the
free tiers** — sets a daily AI spend cap, and flips the new **`AI_FORCE_CHEAP_TIER`** so **every LLM call runs
on the small Llama model** (even calls that asked for the 70B reasoning tier). Reversible; it only changes
settings and reports exactly what it changed.

**Dumping more into Llama.** With `AI_FORCE_CHEAP_TIER` on, the ~190 AI call sites all resolve to
`llama-3.1-8b-instant` on Groq's free tier — the biggest single AI lever. What can move to Llama safely: the
AI concierge/funnel copy, moderation, ranking, survey autofill assist, translation, ad-copy drafting,
sentiment, support triage, catalog text. What benefits from the 70B (turn the force off if a task needs it):
multi-step reasoning, dispute adjudication, and anything doing careful math. Image generation is separate —
it's already on Cloudflare FLUX free tier; set a `SELF_IMAGE_URL` (SDXL/FLUX) to take it to $0 on your own GPU.

**NEW — the autonomous AGENTS now run on free Llama too.** Previously the agent runtime (`agents-runtime/
agent-runtime.ts`) only spoke OpenAI or Anthropic, so every agent step (oversight, optimizer, growth, dispute
prep, etc.) billed OpenAI `gpt-4o`. It now has a **Groq branch** (Groq's API is OpenAI-compatible): when
`GROQ_API_KEY` is set it routes agents to `llama-3.3-70b-versatile` (the 70B, for reliable tool-calling; the
few `mini` pins use `llama-3.1-8b-instant`) — **$0 on the free tier** — and **falls back to OpenAI automatically
if Groq errors or is rate-limited**, so agents never break. This closes the last non-Llama LLM path; with a
Groq key, *all* text generation on the platform — user-facing AI **and** the agents — runs free. Only offload
things that are free or cheaper on Llama (they are — Groq's free tier, then ~$0.0001/1k tokens vs `gpt-4o`);
TTS and images aren't LLM work and stay on their own free tiers (Polly / Cloudflare FLUX).

**NEW — the expanded one-click floor** (`costFloorProfile`) now also: routes images to **Cloudflare's free
FLUX** (was leaving them on a paid provider), sets **`VIDEO_ENGINE_RENDER_PROVIDER=none`** (the video engine
still generates concepts, polls, and learns for free — you only pay when you deliberately wire a render
vendor), turns on **TTS caching**, sets a realistic free-tier cost estimate so any spend cap tracks reality,
and reports the two env "free unlocks" (`REDIS_URL` shared cache, `DATABASE_REPLICA_URL` read replica) plus
whether agents are on free Llama. It changes only settings — never a feature flag — so **everything stays on**.

**Load test before launch.** After applying the floor, run `LOAD-TEST-PLAN.md` (k6/artillery against
`/health`, a read path, and a write path at target RPS) to confirm the free tiers hold under concurrency. The
scale-hardening indexes and read-replica routing are already in place; the load test just proves it.

## Lowest legal & compliance cost — launch on the "straightforward" versions

The cheapest way to keep legal spend near zero at launch is the same trick we used on Tier 2 (pay-as-you-go,
not credit) and Flexible Payments (credit-card only, which removed the money-transmission question): **launch
with only the features that don't require a lawyer or a license, and leave the counsel-gated ones OFF until
revenue justifies them.**

- **Keep OFF at launch (each needs counsel + licensing before it can bill):** `flexpay` (installment credit),
  `tier1_financed` (recourse credit), `goods_advance` (advance credit). All three default OFF and refuse to
  originate — so they cost you nothing legally until you choose to engage a finance attorney.
- **Launch ON (no lender, no counsel gate — "straightforward" by design):**
  - **Tier 1** — a normal upfront advertising purchase.
  - **Tier 2 "Scale"** — bought in 30-day pay-as-you-go parts; each part is a separate purchase, nothing
    deferred, so it is **not credit** and needs no lending gate.
  - **Flexible Payments in `self_financed` mode** — a 0%, 4-installment, credit-card plan *may* qualify for the
    four-installment exemption (no third-party lender). This one still needs a **one-time** attorney
    confirmation, but not an ongoing licensed-lender relationship — the cheapest path into "pay over time."
  - **Rollover/upgrade discount, premium gift boost, Tier 2 scaling** — promotions and store credit, not
    securities or credit.
- **Earnings/results claims cost nothing to run compliantly** thanks to the hypothetical→substantiated
  pattern: the concierge and product pages show a clearly-labeled *hypothetical example* until real data
  passes the sample threshold, then auto-publish the *substantiated* figure with its basis. No counsel review
  is needed to show a hypothetical, and the substantiated numbers are your own real data — so the whole
  "show how it works and the results" story runs at $0 legal cost.
- **Standing invariants that keep you out of trouble for free:** customers never pay a markup
  (`customer_paid_usd = 0`), points stay non-cashable/closed-loop (money-transmission shield), referral and
  ad content carry FTC disclosures, and email is consent-gated with a CAN-SPAM footer. These are enforced in
  code, not by a law firm.

**Net:** launch on Tier 1 + Tier 2 + the non-credit promotions + consent-gated marketing, keep the three
credit products OFF, and your only near-term legal cost is a single attorney read of the `self_financed`
four-installment plan **if** you want pay-over-time on day one. Everything else is already structured to avoid
the spend. (Full detail per feature in the Lawyer Packet docs: `TIER2-SCALING-OFFER.md`,
`FLEXIBLE-PAYMENT-TERMS-COMPLIANCE.md`, `TIER1-FINANCED-PAY-FROM-EARNINGS.md`, `GET-GOODS-ADVANCE-PROGRAM-COMPLIANCE.md`,
`AI-FUNNEL-DESIGN.md`, `PRODUCT-STATS.md`.)

## The free provider stack — AI/media/email at $0 (no GPU)

Every external AI/media service now defaults to a free (or free-tier) hosted provider, each with graceful
fallback so nothing breaks before you add a key. This drives the entire AI + media + email layer to **$0/mo**
at launch scale. The **Setup Wizard** (admin → SetupWizard) shows each one's status live with the exact
free-signup step, and the **Self-host advisor** (admin → ProviderAdvisor) later tells you if/when paid volume
ever makes an owned GPU cheaper.

| Capability | Default provider | Cost | Key to add (free) | Falls back to |
|-----------|------------------|------|-------------------|---------------|
| LLM (all AI: assistant, moderation, ranking, translation) | Groq — Llama 3.1-8B / 3.3-70B | **$0** free tier | `GROQ_API_KEY` (console.groq.com) | OpenAI |
| Speech-to-text (voice surveys) | Groq — whisper-large-v3-turbo | **$0** free tier | same `GROQ_API_KEY` | OpenAI Whisper |
| Image generation (catalog) | Cloudflare Workers AI — FLUX-1-schnell | **$0** free tier | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | Bedrock/Titan (~$0.01/img) |
| Text-to-speech (premium voice) | Device voice (free) / Polly | **$0** (Polly free 5M/mo yr 1) | `PROVIDER_TTS=polly` + AWS creds | ElevenLabs |
| Speech cache | on (`TTS_CACHE_ENABLED`) | **$0** — synthesize once | optional `REDIS_URL` to share | per-instance |
| Transactional email | Amazon SES (~$0.10/1k) or Brevo (free ~9k/mo) | **~$0** | `EMAIL_PROVIDER=brevo`+`BREVO_API_KEY`, or AWS SES | auto-fallback |

**Cost levers, in order of impact:** (1) **cache repeated output** — survey prompts/cheers voice once, feed
searches + translations cached; (2) **free tiers first, paid fallback** — wired for LLM/STT/image/email;
(3) **right-size** — 8B model + cheap voices for the many simple jobs, premium only where it matters;
(4) **shift channels** — reminders via free push + near-free email, SMS reserved for what needs it;
(5) **self-host later** only when the advisor says a GPU (or CPU, for Piper TTS) beats the hosted bills.

## Cost estimate (everything on, from day one)

**Recurring:** the AI/media/email layer runs at **$0/mo** on the free tiers above (with the cost floor's
`AI_FORCE_CHEAP_TIER`, even the LLM line is ~$0–20/mo — all calls on Llama-8B). The recurring cost is
**hosting** — Railway for the backend + Postgres **+ the always-on scheduler service** (the daily jobs),
**~$10–$35/mo** total (add ~$5 for Redis if you want a shared cache). **Legal cost is $0 at launch** — the
credit features ship off behind their counsel gate. SMS is pay-per-use, effectively $0 (held off until TCPA opt-in).

**One-off to launch:** Google Play **$25** (one-time) + a domain **~$15/yr**; add Apple **$99/yr** only if you
ship native iOS. So the **hard cash floor is ~$40** (web + Android) or **~$139** (with iOS).

**Year-one infrastructure (ex-labor):** roughly **$100–$340** — hosting ($60–$240) + the one-off above. All AI,
images, transcription, voice, and email are $0 on free tiers within launch-scale usage.

**Developer labor:** unchanged product (everything is prebuilt and ON), so the developer only deploys, tests,
and submits — **~$1,700–$2,500 at $75/hr**, and **less** to the extent you self-serve the key-plugging through
the Setup Wizard (it turns "developer configures integrations" into a checklist you can run yourself).

**All-in year one: ~$1,800–$2,800**, with the external cash floor at **~$40–$139**. The AI/media portion, which
used to be the scary variable, is now a flat **$0** until you deliberately outgrow the free tiers — at which
point the advisor flags the cheapest next step.

## Scaling survey supply to Swagbucks size (start with BitLabs)

Supply is the constraint at scale — millions of users need many redundant survey networks so there's always
inventory. The provider registry (`backend/sdk/survey-providers.ts`) ships with **11 networks wired**:
BitLabs (ON at launch), CPX Research, TheoremReach, Pollfish, InBrain, TapResearch, Cint/Lucid, AdGate,
ayeT-Studios, Revlum, Prodege. **Only BitLabs is on**; the rest are OFF until you sign each one and add its
key. Flip `PROVIDER_<NAME>_ENABLED` on (and set `<NAME>_API_KEY`) as you onboard them — the router serves
whichever networks are enabled + configured, so adding supply is a settings toggle, not a code change.

The path to 100M-user scale is: (1) BitLabs at launch; (2) add CPX + TheoremReach + Pollfish early (biggest
easy supply); (3) add Cint/Lucid for enterprise-grade volume; (4) your own **AdGrid** inventory grows with
every advertiser you sign (highest-paying, fully yours). Redundant networks also mean no single provider
outage stops earning.

## New-feature cost levers (voice, translation, buddy/group)

- **ElevenLabs voice** is a **premium perk** by default (`TTS_ELEVENLABS_FOR_NONPREMIUM=0`); non-premium
  uses the device's built-in voice (free). So voice costs scale only with premium usage.
- **Chat translation** is cheap-tier + do-once cached (`chat-i18n.ts`) — each unique line translates once.
- **Voice survey assistant** runs on your own AdGrid surveys only (no per-user human labor — the AI reads and
  the user speaks their own answer).
- **Anti-scam + answer-wall** are pure code (regex), zero AI cost.
- Everything above still respects `AI_DAILY_SPEND_CAP_USD` — the global brake covers voice + translation too.
