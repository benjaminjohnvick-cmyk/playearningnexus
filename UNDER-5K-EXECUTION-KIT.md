# Under-$5K Execution Kit — GamerGain / PlayEarning Nexus

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
  points); **12%/24%-of-balance per-transaction spend cap**; PPC AdGrid **$8,000**; double-ROI free-social
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

- **All AI calls use the cheap model tier** (`gpt_5_mini` → gpt-4o-mini / claude-3-5-haiku by default).
- **Rules-first before AI** on moderation/triage; **caching** on translations and now **product-feed
  searches** (`PRODUCT_FEED_CACHE_TTL_S`, 1h) so discovery doesn't re-bill the feed API.
- **AdGrid ad copy** is advertiser-written by default; AI generation is opt-in per ad.
- **`AI_DAILY_SPEND_CAP_USD`** is the global hard brake — set it and no path can exceed it.
- Nothing is turned off to save money; the floor comes from cheap tiers + caching + rules-first, not from
  disabling features.
