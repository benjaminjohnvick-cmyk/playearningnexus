# Codeable Cost Levers — everything ON, just cheaper

**Prepared 2026-07-30.** This is the complete list of *code* changes that lower GamerGain's runtime bill
**without turning any feature off**. Every lever here is pure efficiency — cheaper model tiers, caching,
batching, dedup, sampling, pruning, and activating infrastructure that's already written but dormant. No
feature is disabled; the platform stays fully on from the get-go.

Grounded in an actual sweep of the code — each lever names the file so it's implementable, not theoretical.

---

## The two "free unlocks" (scaffolding already written, called by nothing)

These are the highest return for the least work, because the hard part is already built.

1. **Activate the read-through cache (`backend/sdk/cache.ts`).** A full cache layer exists — Redis when
   `REDIS_URL` is set, in-process `Map` otherwise — with a `cached(key, ttl, produce)` helper. Its own
   header says "nothing calls this yet." Wrapping the hot, repetitive reads in `cached(...)` is the single
   biggest lever in the codebase (see LLM-2, DB-2, EXT-1). Works with zero infra as an in-process cache;
   set `REDIS_URL` to make it shared across instances.
2. **Flip on the read replica (`backend/sdk/db.ts`).** Read-replica routing is fully built and dormant —
   every `db.filter/get/list` already flows through `withReadClient`, which uses the replica only when
   `DATABASE_REPLICA_URL` is set and falls back to primary automatically. Setting that one env var offloads
   **all** read traffic off the primary with zero code change. (Pooling is already on: shared pool size 10,
   `PG_POOL_SIZE`.)

---

## A. LLM / AI spend — the biggest variable cost

The platform funnels ~200 `InvokeLLM` call sites through `backend/sdk/integrations.ts`. Almost none are
tiered or cached today, so this is where most of the money is.

**LLM-1 — Default to the cheap model tier (highest single $ impact).**
Model aliases live in `integrations.ts` (`resolveModelId`, ~line 97). When a call omits `model:`, the alias
is `"default"` — and on the Anthropic path `CLAUDE_MODEL_MAP.default` is **Sonnet (the expensive tier)**
(line ~93). Only **9 of ~200 call sites** pass an explicit model, so **~190 sites silently run on Sonnet**
while doing simple structured work (translation, moderation, classification, triage, short ad/social copy,
survey scoring, catalog copy). Change: point `CLAUDE_MODEL_DEFAULT` (live-overridable via `snapString`) at
Haiku, and explicitly opt *only* the reasoning-heavy sites (dispute analysis, optimizer synthesis, the
assistant) up to `gpt_5`/Sonnet. One change retunes ~190 sites; AI stays fully on, just on the right-sized
brain. Rough order: small-tier models are ~10–20× cheaper per token than the large tier.

**LLM-2 — Cache translation and deterministic copy.**
`translateText`, `translateSurvey`, and `multilingualTranslator` call the LLM to translate UI strings **on
every request, uncached** — the same labels are re-translated on every page load. Wrap them in `cached()`
keyed on `hash(texts + targetLang)` (near-permanent TTL; strings rarely change). Same treatment for catalog
seed copy (`sdk/catalog.ts`) and category/browse-node descriptions — deterministic prompt in, same text out.
Translation is the clearest repeat-spend in the app; cache hit-rate here approaches 100%.

**LLM-3 — Batch the per-item LLM loops.**
Several jobs fire one LLM call per row in a loop:
- `premiumPPCAutoAdvertise` composes ad copy with a **separate call per advertiser** (up to ~2000). Batch
  into one call returning an array keyed by advertiser id.
- `emailMarketingAutomation` and `retentionCampaignEngine` call the LLM **per user** for personalized copy.
  Generate one copy **per segment**, not per recipient (the hidden cost inside the email jobs).
- `aiGrowthContentEngine` makes 4 sequential calls (analysis → script → threads → captions) that collapse
  into one structured call.
- `identifyAndEnrollUnderperformers` makes 3 calls per user. Batch per cohort.

**LLM-4 — Gate the optimizer / orchestrator loops on "new data."**
The daily `aiOptimizerRun` and the four stacked every-6h orchestrators (`masterOrchestrator`, `aiOrchestrator`,
`learningDistill`, `aiExperimentEvaluate`) fire LLM synthesis **on the clock even when nothing changed**. In
`sdk/optimizer.ts` (`proposeChange`, ~line 280) the LLM call happens *before* the "hold / no-change"
short-circuit — move it *below* the hold check, and skip it when the metrics snapshot hash is unchanged
since the last run. Gate the orchestrators on a cheap "new rows since last cursor" counter. Same optimization
quality, far fewer calls on quiet days.

**LLM-5 — Skip regeneration when inputs are unchanged.**
`premiumPPCAutoAdvertise` regenerates each advertiser's ad copy **daily** even when their business name and
description haven't changed. Cache keyed on those fields (ties into LLM-2/LLM-3) and skip when unchanged.

---

> **Update (2026-07-30):** the store catalog images are generated **once** and reused for the life of the
> store, so image generation is a **one-time** cost, not recurring — the image levers below (cheaper
> provider, 512² tiles, metering generation against the cap) have little ongoing impact and can be treated
> as optional polish. Separately, verified-survey recordings are now **never stored** (transcribed in
> memory, then discarded), so lever **STO-1 is resolved by design** — there is no media to purge.

## B. Image generation

Category tiles and catalog images go through `GenerateImage` in `integrations.ts`. Dedup is mostly good
(tiles generate once per category; product templates are generated once globally and cloned per country
without regenerating — this is already correct). The gaps:

**IMG-1 — Default `IMAGE_PROVIDER` to `aws_bedrock` (Nova Canvas).**
The default when `IMAGE_PROVIDER` is unset is **OpenAI DALL·E-3 (~$0.04/image, the most expensive path)**.
Bedrock Nova Canvas / Titan is roughly $0.01 or less. Changing the default keeps images fully on at 1–4× less
per image. (Env flip today; I can also change the code default.)

**IMG-2 — Meter image generation against `AI_DAILY_SPEND_CAP_USD`.**
`GenerateImage` never calls the spend meter — image spend **completely bypasses** the one global brake (only
LLM calls are metered). Add `assertAiSpendUnderCap()` before and `recordAiUsdSpend(perImageCost)` after each
of its four provider branches, so images honor the same daily ceiling. Codeable, ~10 lines.

**IMG-3 — Generate/store tiles at 512×512, not 1024×1024.**
`CATALOG_IMAGE_SIZE` defaults to 1024². Category/department tiles are displayed small and never need full
size — generating and storing them at 512² cuts generation cost, S3 storage, and bandwidth with no visible
change. (A per-purpose size, or just a lower default.)

**IMG-4 — Store WebP + put a CDN in front of S3.**
Images are stored as full-size PNG and served from the S3 origin — every view is a billed S3 GET + egress.
Store WebP (smaller) and point `S3_PUBLIC_BASE` at CloudFront so repeat views are served from the CDN edge
instead of billed S3 gets.

**IMG-5 — Fence off the legacy per-country image path.**
`generateSeedListings` in `sdk/catalog.ts` generates a fresh image **per listing per country with no
template reuse** — it's currently unused but exported. Leave a guard/comment (or remove the export) so no
future wiring accidentally regenerates images per country and blows up the image bill.

---

## C. Database / compute

**DB-1 — Add `db.count()` and `db.sum()` primitives (largest DB win).**
The Postgres shim has no count/sum — so the code fetches whole tables to count or total them in app code.
The worst is the loyalty capacity governor (`sdk/loyalty.ts`): a **single eligibility check scans the entire
User table twice plus the whole membership table** (`db.filter("User", {}, undefined, 200000).length`, etc.),
and it runs on every enrollment/eligibility check. The optimizer snapshot does ~15 fetch-to-sum passes.
Adding `db.count(entity, query)` → `SELECT count(*)` and `db.sum(entity, field, query)` →
`SELECT sum((data->>'f')::numeric)` collapses million-row transfers into single scalar queries. Highest-
leverage DB change.

**DB-2 — Cache loyalty capacity (30–60s).**
Even before DB-1, the capacity numbers change slowly. Wrap `hasLoyaltyCapacity()` / `computeLoyaltyCapacity()`
in `cached()` with a 30–60s TTL — eliminates the most expensive repeated scan in the codebase on hot paths.

**DB-3 — Fix `liveExperimentTick` (biggest compute win).**
It runs **every 10 minutes** (144×/day) and, for each running experiment × each metric, scans up to **20,000
`LiveMetricEvent` rows** (`sdk/live-experiments.ts`, `measure()`). Either keep **running counters** on the
experiment row (increment on write, no re-scan) or widen the cron to `*/20`–`*/30`. The A/B system stays
fully live; it just stops re-counting from scratch every 10 minutes.

**DB-4 — Batch the N+1 query loops.**
Add a `db.filterIn(entity, field, ids[])` (single `WHERE ... IN`) and use it in `groupGoalStatus`'
`earningsByIds` (today one `User.filter({id})` **per member**, and in the list branch, per member **per
group**). Batch the per-member writes in `loyaltyDailyReconcile` and the 2000-user loop in
`autoPointsBoostCredit`.

**DB-5 — Clamp the client-controlled list limit + index hot sort fields.**
`server/entity-routes.ts` passes `body.limit` straight through with no server cap — a caller can request an
arbitrary limit on any entity. Clamp it to a max. Add JSONB expression indexes for the hot non-system sort
fields (`at`, `current_balance`, `updated_at`) that currently sort via unindexed `data->>'field'`.

**DB-6 — Cache the per-request auth user.**
`auth.me()` reads the User row on **every authenticated request** (memoized only within one request). A short
per-user TTL cache removes one User read per request across the whole API.

---

## D. Telemetry & storage growth (unbounded today)

**STO-1 — ✅ RESOLVED (2026-07-30): recordings are never stored.**
The verified-survey flow no longer writes any raw voice/video to storage — it transcribes in memory and
discards the audio, keeping only the non-biometric transcript + validity/fraud scores. So there is nothing
to purge, zero recording-storage cost, and no gap against the deletion promise. (Superseded the earlier
plan to add a retention/purge job.)

**STO-2 — Actually prune telemetry / heatmap snapshots.**
`pruneTelemetry()` exists in `sdk/telemetry.ts` but **no cron calls it**, and it only fetches 2000 rows and
stops early, so raw `InteractionEvent` (and `UXHeatmapSnapshot`) grow unbounded. Convert to a single
`DELETE ... WHERE at < cutoff` and schedule it daily.

**STO-3 — Turn on the telemetry auto-throttle and sample.**
Telemetry is already coalesced (one row per batch, not per event) — good. But `OVERHEAD_MAX_EVENTS_PER_DAY`
defaults to 0 (no ceiling, so the built-in auto-throttle never engages) and `TELEMETRY_SAMPLE_PCT` defaults
to 1.0 (100%). At scale, set the ceiling and drop the sample to ~0.25 — the statistical signal stays valid
and the learning loops keep running; you just store a representative quarter.

---

## E. External APIs, email & SMS

**EXT-1 — Cache the geo-IP lookup.**
`checkSurveyFraud` calls `ipapi.co` on **every survey submission, uncached** — the free tier will rate-limit
at volume and it re-queries the same IP every time. Wrap in `cached()` keyed on IP with a 24h TTL.

**EXT-2 — Batch email sends and frequency-cap digests.**
Every scheduled digest (`sendDailyReminder`, `surveyStreakReminder`, `sendSurveyNotifications`,
`notifyWeeklyTopEarners`, `emailMarketingAutomation`) loops all users and calls `SendEmail` **once per
recipient**. SendGrid's `personalizations[]` accepts up to 1000 recipients per call (SES has `SendBulkEmail`)
— batching cuts email-API volume by up to ~1000×. Also add a per-user daily frequency cap so the same user
isn't emailed by three jobs the same day. (Emails keep going out — just batched and de-duplicated.)

**EXT-3 — Transcription (already optimized).**
Device-first free transcription is in; Whisper is fallback only and metered. Remaining knob:
`VERIFIED_SURVEY_MAX_AUDIO_MB` (25) bounds per-clip Whisper cost on the fallback path.

---

## What I can implement in code now vs. what's an owner flip

**Owner env flips (no code — do these first, they're free):**
`DATABASE_REPLICA_URL` (read replica), `REDIS_URL` (shared cache), `IMAGE_PROVIDER=aws_bedrock`,
`AI_DAILY_SPEND_CAP_USD` (already exists), `TELEMETRY_SAMPLE_PCT`, `OVERHEAD_MAX_EVENTS_PER_DAY`,
`CATALOG_IMAGE_SIZE`.

**Code changes I can make (ranked by impact):**
1. LLM-1 model default → small tier (retunes ~190 sites) — *biggest AI win.*
2. DB-1 `db.count()`/`db.sum()` + use in loyalty/optimizer — *biggest DB win.*
3. LLM-2 / EXT-1 activate `cache.ts` on translation + geo-IP — *biggest "already-built" win.*
4. STO-1 media-purge job (+ S3 delete helper) — *cost + compliance.*
5. IMG-2 meter images against the spend cap — *closes the one uncapped spend path.*
6. DB-3 incremental `liveExperimentTick` — *biggest compute win.*
7. LLM-3 batch the per-advertiser / per-user LLM loops.
8. STO-2 telemetry prune cron; DB-4 batch N+1s; DB-5 clamp limits + indexes; IMG-3 512² tiles; LLM-4/5
   optimizer gating; DB-6 auth cache; EXT-2 email batching.

Every item above keeps the platform fully on. None disables a feature; they change *how* the work is done,
not *whether* it runs.

## Latest levers (this session's features — applied in code)

- **LLM-6 — cheap tier on every new AI path.** The AI Shopping Assistant (`aiOrderAssistant`), AdGrid ad
  generation (`createAdGridAd`), and the growth-plan narrative (`growthBudgetAutoPlan`) all call the
  `gpt_5_mini` tier (gpt-4o-mini / claude-3-5-haiku). No premium-model calls in the hot paths.
- **CACHE-3 — product-feed search cache.** `searchProductFeeds` is wrapped in `cached()`
  (`PRODUCT_FEED_CACHE_TTL_S`, default 1h). Discovery is the most-called external path; caching it means
  repeated/near-duplicate searches don't re-bill the feed API. *Biggest new external-cost win.*
- **LLM-7 — AI generation is opt-in.** AdGrid ad copy + product pages are advertiser-written by default; the
  AI drafts them only when `ai_generate:true` is passed. The assistant's LLM ranking is a thin call over
  already-fetched results and degrades to "cheapest match" with no LLM if a key isn't set.
- **GATE-2 — graceful-without-keys.** PayPal, product feeds, dropship, and Whisper all no-op cleanly when
  their key/account isn't set — no failed external calls (and no spend) before you connect them.
- **BRAKE — `AI_DAILY_SPEND_CAP_USD`** still governs every provider path as the global hard ceiling.

## Latest levers (2026-08-03 — one-command floor + revenue offsets)

- **FLOOR-CMD — `npm run cost:floor`** (`deploy-kit/cost-floor.mjs`). One command pins EVERY lever above to
  its floor value in `backend/.env` and prints a full readout (free-tier providers, do-once caching,
  rules-first, right-sized 8B + FLUX-4-step, in-memory cache, per-feature governors). `--cap 5` also sets the
  global AI spend brake. Idempotent; re-run any time. Because every setting is env-overridable by its own key
  (`settings.ts` resolves env → DB → default), writing these to `.env` makes them take effect.
- **OFFSET — revenue that funds the floor (ON by default).** Three levers generate income against the ~$5–20/mo
  hosting: the **30s survey interstitial** (own-inventory ad, non-premium → your ad revenue), the
  **marketplace-equivalent hold** (`MARKETPLACE_EQUIV_HOLD_ENABLED`, an equal % of gross survey revenue since
  you hold no inventory), and the opt-in **shopping-extension affiliate cashback** (`SHOPPING_*`, your share of
  commission). Net cost trends toward zero as usage grows.
- **READOUT — surfaced everywhere.** `setup.mjs`, `env-check.mjs`, and `cost-floor.mjs` all print the same
  cost-at-the-floor picture, so the owner sees exactly which capabilities are free vs. on a paid fallback.

Same rule as before: everything stays **on from the get-go**; the floor comes from cheap tiers, caching,
rules-first, right-sizing, and revenue offsets — never from switching a feature off.
