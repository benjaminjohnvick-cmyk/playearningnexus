# GamerGain / Get Goods Gratis (Free) — Complete Feature & Function Disclosure Brief

**Prepared for patent counsel · 2026-09-05 · Confidential — attorney work-product / invention disclosure**

> **Purpose.** This brief is a **100% inventory** of the platform's implemented features and functions, so counsel can decide what is worth pursuing for patent protection. It is generated directly from the live codebase — every backend function is listed with the description carried in its own source, alongside the software engines (SDK modules), user-facing surfaces (pages), the data model (entities), and the configurable capability flags. **Nothing is omitted.** This is a disclosure of what exists and how it works; it is **not** a legal opinion on novelty or patentability — that determination is counsel's, aided by a prior-art search. Not legal advice.

## How to read this brief

- **Section 1 — Patent-candidate highlights.** The subsystems most likely to be worth counsel's attention, described at invention-disclosure depth (mechanism, inputs, novelty angle). Start here.
- **Section 2 — Software engines (SDK modules).** The 195 backend engines that implement the platform's logic — the 'how it works' layer where most inventive mechanism lives.
- **Section 3 — Complete backend function inventory.** All 983 backend functions (API endpoints, scheduled jobs, automations), grouped by domain, each with its code-sourced description.
- **Section 4 — User-facing surfaces.** All 272 application pages/screens.
- **Section 5 — Data model.** All 364 persisted entity types.
- **Section 6 — Configurable capabilities.** The ~1,200 capability/feature flags across 50 categories that govern platform behavior.

**Scale at a glance:** 983 backend functions · 195 software engines · 272 pages · 364 entity types · ~1,200 capability flags across 50 configuration categories.

---

## 1. Patent-candidate highlights (start here)

*The subsystems below are the ones most likely to merit counsel's attention, described at invention-disclosure depth — the mechanism, its inputs, and the angle that may distinguish it. **Whether any of these is novel and non-obvious is counsel's determination, aided by a prior-art search — this brief does not opine on patentability.** Each cross-references the engine(s) and design doc(s) that implement it. A companion invention-disclosure doc, `PATENT-GROUNDWORK-AND-INVENTION-DISCLOSURE.md`, carries earlier groundwork.*

### 1.1 Closed-loop non-cashable value economy
Users earn and spend a platform credit ("Site Cash") that is **non-cashable by design** and never converts to money user-side; only **businesses** receive real-money settlement. The mechanism is a two-sided ledger separation — a user-facing non-cashable balance versus a business-facing real-money rail — with one-directional value flow and breakage accounting, so the consumer surface stays outside money-transmission while advertisers pay real money. *Engines: `economy-*`, `revenue`, `payout-*`, `site-cash*`. Docs: `SITE-CASH-AND-OWNERSHIP.md`, `PAYOUT-CLOSED-LOOP.md`.*

### 1.2 Graduated-autonomy trust kernel ("Autonomy Kernel")
A single reusable engine that lets **any** automated process graduate from human-in-the-loop to full autonomy on shared trust rules. Every automatable decision is assigned to a **domain** classed either `auto_ok` (safe, reversible — *earns* autonomy once it clears data-driven thresholds: enough approved decisions, a high human-agreement rate, and a deep-enough decision history) or `permanent_gate` (money / identity / legal / risk — **never** auto-approves, regardless of data). The novelty angle is the generalization of a per-feature autopilot into a platform-wide, deterministic, unit-tested trust engine whose gate decision is a pure function of trust signals + thresholds, with a global kill switch overriding all. *Engine: `autonomy-kernel.ts` (+ `ai-autonomy.ts`, `agent-guardrails.ts`). Doc: `AUTONOMOUS-AI-AND-FOUNDING-DATA-DESIGN.md`.*

### 1.3 Self-learning optimizer with consent-first testing and auto-revert
A closed optimization loop — **collect** signals from live activity → **recommend** a change (bandit/hill-climb over history + optional LLM rationale, clamped to registry bounds) → **apply-or-queue** (non-sensitive changes auto-apply; money/price/legal changes route to human approval) → **learn** (measure the objective before/after and **auto-revert** any change that regressed it). Two distinguishing mechanisms: (a) every candidate change is first put to **real users as an individual yes/no experiment** and only a statistically-approved change becomes eligible for site-wide promotion; (b) a **go-live gate** keeps the whole loop advisory (recommend-only) until the operator flips the site live, after which non-sensitive changes auto-apply within the same guardrails. *Engines: `optimizer.ts`, `experiments.ts`, `live-experiments.ts`, `ai-autonomy.ts`.*

### 1.4 Retention-weighted product-market-fit scoreboard + PMF/revenue agent
Ranks every monetizable feature by a composite **PMF score** deliberately dominated by **retention lift** — the fraction of a feature's prior-window adopters who return in the recent window, minus the site baseline, **shrunk toward zero for small samples** (`n/(n+K)`) so low-sample features can't top the board on noise — with adoption, engagement, and the feature's own revenue slice filling the rest. A scheduled agent turns each feature's PMF + revenue into an action plan (promote / hold / watch / fix / sunset) with advisory pricing hints, while every sensitive move stays human-gated. A **founding cohort** is measured separately as a before/after. *Engines: `feature-pmf.ts`, `pmf-agent.ts`, `advertiser-features.ts`, `revenue-coverage.ts`. Doc: `TIERED-FEATURE-CATALOG-AND-PMF.md`.*

### 1.5 Dollar-budget-derived auto-scaling governor with burst and hysteresis
An infrastructure governor that derives its **normal maximum replica count from a monthly dollar budget** (`soft_max = min(hard_max, floor(budget / cost_per_instance))`) rather than from a fixed instance number, holds a standing minimum, and — when live load genuinely exceeds the budgeted capacity — **auto-bursts past the dollar budget** up to a separate emergency ceiling to avoid shedding load, then **self-reverts on hysteresis** once the spike passes, so over-budget spend applies only for the minutes a surge lasts. It self-heals to the minimum after a deploy and reconciles every scheduled tick, and is provider-abstracted (drives the host's scaling API). *Engines: `infra-scale.ts`, `infraScaleController`. Doc: `AWS-200M-PATH.md`, `LAUNCH-ESTIMATE-2026-07-30.md`.*

### 1.6 Tiered device-offload of compute and hosting
A safe, tiered scheme for pushing work onto end-user devices to make server cost **fall as the user base grows**: Tier 1 device-side reads, Tier 2 device compute (server stays authoritative and re-validates), Tier 3 device-hosted game/live sessions with per-capability gates — with an explicit list of what is *never* placed on a device (money, identity, authority). *Engine/doc: `DEVICE-OFFLOAD-TIERS.md`, hosting/session engines.*

### 1.7 Structurally-bounded first-party data collection
Comprehensive first-party product-analytics collection for a consenting cohort that is **incapable by construction of collecting a new data category**: a manifest enumerates the allowed first-party, already-disclosed categories, and a write-time **hard guard** refuses any category not on it — so "collect everything" cannot silently become "collect a new kind of personal data" without an explicit, gated change. Consent-gated and internal-only. *Engine: `founding-data.ts`. Doc: `AUTONOMOUS-AI-AND-FOUNDING-DATA-DESIGN.md`.*

### 1.8 Price-held / ratio-climbing tiered feature monetization
Advertiser revenue streams are presented as add-on features across tiers under a rule where the **price is held and the delivered-value ratio climbs** as more live features stack, and a **gated/counsel feature contributes $0 of claimed value until it is actually live** — a monetization+disclosure mechanism that increases stated value without a price change or a performance promise. *Engine: `advertiser-features.ts`. Doc: `TIERED-FEATURE-CATALOG-AND-PMF.md`.*

### 1.9 Capacity-paced full-value delivery guarantee with automatic make-good
Advertising delivery guaranteed **by amount, not by date** — delivered in full however long it takes, at no extra cost — with an automatic **make-good** mechanism when delivery lags, framed strictly as advertising delivered (never revenue/ROI). *Engines: `delivery-guarantee.ts`, `tier2-inventory-governor`. Docs: `FULL-VALUE-DELIVERY-GUARANTEE.md`, `DELIVERY-GUARANTEE-MAKEGOOD.md`.*

### 1.10 Milestone-anchored founding-term engine
A subscription-term mechanism where a member's benefit year **does not begin at signup** but is anchored to the date a platform-wide user-count **milestone** is reached (stamped once, idempotently), combined with a no-fill-deadline offer that stays open until an availability cap fills. *Engine: `founding-advertiser.ts`, `foundingProgramMilestone`. Doc: `FOUNDING-PRE-REVENUE-OFFER-AND-TIER1-SPEC.md`.*

### 1.11 Revenue-levers governance registry
A single introspectable registry of **every** monetization sub-point across eight categories, each carrying a built/gated/counsel status and an enable-flag the registry reads live — a governance surface that reports, per lever, whether it is switched on without bypassing its own compliance/counsel gate. *Engine: `revenue-levers.ts`, `revenue-coverage.ts`. Doc: `REVENUE-STREAMS-EXPANSION.md`.*

### 1.12 Compliance-gated capability architecture ("everything on, gates held")
A systematic build pattern: the product ships feature-complete with essentially every capability **on by default**, while each money/credit/identity/legal-sensitive capability ships **off behind a specifically-named prerequisite gate** (a processor account, a verifiable opt-in, or a counsel sign-off) that is a one-line flip once its prerequisite exists — so unlaunched regulated features carry **$0 legal cost** until deliberately unlocked. *Engines: `counselFeatureGate`, `revenue-levers.ts`, settings gate flags. Docs: `EVERYTHING-ON-FROM-DAY-ONE.md`, `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`.*

### 1.13 Closed-loop attention-rewards browser extension
A browser extension that rewards attention (ad views / affiliate actions) in **closed-loop non-cashable Site Cash**, with server-authoritative validation and rate/lifetime caps as cost governors. *Engine: `extension.ts`, `extension*` functions. Doc: `BROWSER-EXTENSION-ATTENTION-REWARDS-DESIGN.md`.*

### 1.14 AI order fulfillment with human-gated money and batch sourcing
An AI pipeline that places and sources store orders within a per-order dollar cap and a batch-orders path, where the sourcing/markup is automated but every money-moving action remains human-gated. *Engines: `ai-order-*`, `placeStoreOrder`, `cancelStoreOrder`. Doc: `AI-ORDER-FULFILLMENT-AND-BATCH-ORDERS-COMPLIANCE-BRIEF.md`.*

### 1.15 One-command multi-provider cost floor with revenue offsets
A single operator command that pins every AI/DB/external-API lever to its cheapest tier at once (cheaper model tiers, caching, provider fallbacks), paired with revenue-offset levers that fund the residual runtime floor — an efficiency-without-feature-loss mechanism. *Engines: `deploy-kit/cost-floor.mjs`, `settings` cost levers. Docs: `COST-LEVERS-CODEABLE.md`, `COST-FLOOR-AND-LOW-LEGAL.md`.*

*Beyond these highlights, the inventory that follows lists the full 983 functions, 195 engines, 272 surfaces, and 364 entities so counsel can spot additional candidates the highlights don't call out.*

---

## 2. Software engines (SDK modules) — 197

*Each engine is a self-contained module implementing one subsystem's logic. Descriptions are the module's own header summary from source.*

- **`ad-branding`** — ad-branding.ts — house branding stamped on EVERY ad across all three tiers: a Get Goods Gratis logo
- **`ad-learning`** — ad-learning.ts — closes the learn→improve loop for the Premium PPC AI advertiser.
- **`adgrid`** — adgrid.ts — the PPC AdGrid survey engine (premium tier). A grid of product thumbnails; each carries 2
- **`adgrid-access`** — adgrid-access.ts — who may pull the high-paying AdGrid inventory, and with what priority.
- **`advance`** — advance.ts — the FREE, NON-RECOURSE purchasing-power advance ("money upfront, work it off with surveys").
- **`advertiser-cancellation`** — advertiser-cancellation.ts — 30-day proportional cancellation (cooling-off) for every advertiser tier.
- **`advertiser-features`** — advertiser-features.ts — the TIERED ADVERTISER FEATURE CATALOG.
- **`advertiser-metrics`** — advertiser-metrics.ts — the conventional PPC metric set for an advertiser, computed from REAL platform data,
- **`advertiser-surveys`** — Advertiser-as-survey-taker — shared config + helpers.
- **`affiliate`** — Affiliate program — flat, tier-based bounties (single-tier, performance-based; NOT MLM).
- **`age-gate`** — age-gate.ts — the shared 18+ gate for value-realization paths (redeem / cash-out). The platform is 18+ and
- **`agent-guardrails`** — agent-guardrails.ts — the shared safety framework for the platform's ADVISORY agents (the scaling advisor and
- **`ai-ad-manager`** — ai-ad-manager.ts — the dedicated AI system that DELIVERS the Tier 2 "Scale" package (options A–D) with no
- **`ai-autonomy`** — ai-autonomy.ts — the ONE place that answers "may an AI process auto-apply a NON-SENSITIVE change right now?"
- **`ai-control`** — ai-control.ts — the global "AI is on, but a human is watching" layer.
- **`ai-funnel`** — ai-funnel.ts — the AI concierge funnel engine. ONE recommender across the whole catalog with TWO gates:
- **`ai-host`** — ai-host.ts — pure logic for the "AI-hosted fallback live session." When an advertiser's product isn't
- **`answer-match`** — answer-match.ts — the FREE, rules-first survey answer matcher.
- **`app-taxonomy`** — App Store taxonomy — the mobile-app catalog structure, mirroring the retail marketplace TAXONOMY so
- **`assistant-memory`** — assistant-memory.ts — per-user memory for the catalog shopping assistant. Every user gets their OWN
- **`auth`** — JWT auth — replaces base44.auth. Tokens are signed HS256 with AUTH_JWT_SECRET.
- **`autonomy-kernel`** — autonomy-kernel.ts — the ONE reusable engine that lets any process across the platform graduate from
- **`balance`** — Atomic balance adjustment helper.
- **`billing-cadence`** — billing-cadence.ts — 13 four-week billing periods a year (52 weeks ÷ 4 = 13, one more than 12 months).
- **`billing-schedule`** — billing-schedule.ts — "52 weeks up front, tracked in 13 four-week cycles" for every advertiser tier.
- **`boosts`** — boosts.ts — closed-loop Site-Cash EARN BOOSTS. A user spends non-cashable Site Cash to activate a
- **`buddy`** — buddy.ts — paired accountability/encouragement while earning ("earn together").
- **`buddy-profile`** — buddy-profile.ts — turn a user's KYC (first-survey) answers into a browsable, privacy-safe buddy profile.
- **`buddy-schedule`** — buddy-schedule.ts — "book your next Buddy Chat" scheduling + cross-timezone coordination.
- **`burst`** — burst.ts — "earn on the go": complete surveys in short bursts through the day, resumable across devices.
- **`business-accounts`** — business-accounts.ts — the BUSINESS side of the platform (advertisers, sellers, sponsors, brands).
- **`cache`** — Cache adapter — DORMANT scale scaffolding, behind a flag. No behaviour or cost change
- **`catalog`** — Marketplace catalog framework (LEGAL by design).
- **`catalog-policy`** — Catalog category guardrails for AI order fulfillment (Master Plan #7).
- **`chat-i18n`** — chat-i18n.ts — translate buddy/group chat so people in different countries can talk, each reading in their
- **`commitment`** — commitment.ts — the daily survey commitment: the user picks a time to do their $8 of surveys, and we
- **`concept-polling`** — concept-polling.ts — the pure core of the Concept Polling loop: auto-generated video CONCEPTS are put in
- **`consent-ledger`** — Immutable consent & disclosure ledger (Master Plan 0.3).
- **`content-license`** — content-license.ts — the rights attestation + license grant captured when a user uploads content (ad
- **`contest-rules`** — contest-rules.ts — the canonical Official Rules for the weekly prize competition, assembled from
- **`cosmetics`** — cosmetics.ts — the closed-loop virtual-goods economy. Users spend non-cashable Site Cash (current_balance,
- **`country-compliance`** — country-compliance.ts — geo-aware compliance profiles. Resolves, per user country, the posture the site
- **`creative-suite`** — creative-suite.ts — the end-to-end AI Creative Suite shared across all three advertiser tiers.
- **`cross-promo`** — cross-promo.ts — the flywheel's connective tissue. One place that decides, for a given user at a given
- **`currency`** — currency.ts — pure currency conversion + metadata. The LIVE rates are fetched by currencyRates from an
- **`db`** — Postgres layer + Base44-compatible query translation.
- **`delivery-guarantee`** — delivery-guarantee.ts — the compliant, all-tiers DELIVERY make-good.
- **`disclosure`** — FTC endorsement / advertising disclosure helper (Master Plan #11).
- **`dropship`** — dropship.ts — the FULL-AUTOMATION channel. Places real orders through an AUTHORIZED supplier API (your
- **`earn-back`** — earn-back.ts — the Prepay & Earn-Back Discount guardrails.
- **`earn-cap`** — Per-user daily earnings cap (DAILY_EARN_CAP_USD; 0 = no cap).
- **`earn-hook`** — earn-hook.ts — the compliant mobile re-engagement layer: a one-tap-to-earn widget hook, an end-of-session
- **`earn-rate`** — earn-rate.ts — survey-minutes → Site Cash → item ownership math.
- **`earned-advertiser`** — earned-advertiser.ts — the FREE "earn-to-unlock" advertiser tier + the no-upfront (participation-term)
- **`earnings-setaside`** — earnings-setaside.ts — user-controlled "set aside part of my earnings" allocation.
- **`earnings-whatif`** — earnings-whatif.ts — the user's OWN "what-if" earnings scenario. The compliant replacement for
- **`email-smtp`** — SMTP email provider (EMAIL_PROVIDER=smtp). Handy for local dev with Mailhog, or any
- **`endorser-rewards`** — endorser-rewards.ts — the pure, compliant core of the opt-in paid-endorser ("Amplify") program: members
- **`events`** — Lightweight in-process domain-event bus. `emitEvent()` records a DomainEvent row and
- **`expenses`** — expenses.ts — a tiny expense ledger for the growth-budget engine. Records real business costs (marketing,
- **`experiments`** — AI change-gating: test every proposed change with customers BEFORE it goes live.
- **`extension`** — extension.ts — the browser-extension backend: attention rewards on OUR OWN inventory, affiliate cashback with
- **`fair-choice`** — fair-choice.ts — present a set of options (current-event topics / ads) for the user to CHOOSE from, in a
- **`feature-flags`** — Compliance feature-flag / kill-switch layer (Master Plan 0.1).
- **`feature-pmf`** — feature-pmf.ts — the AI PRODUCT-MARKET-FIT SCOREBOARD.
- **`feedback`** — feedback.ts — ONE standard feedback event for every customer-interaction surface on the site, and the
- **`flexpay`** — flexpay.ts — "Flexible Payment Terms": a LAST-RESORT downsell that splits a product's price into
- **`founding-advertiser`** — founding-advertiser.ts — the "Tier 1" introductory advertising offer (see ADVERTISER-FUNDED-LAUNCH.md).
- **`founding-data`** — founding-data.ts — comprehensive FIRST-PARTY data collection for the pre-revenue / founding panel.
- **`founding-rollover`** — founding-rollover.ts — the founding advertiser's UPGRADE DISCOUNT (decoupled from the payment) plus the
- **`full-value-guarantee`** — full-value-guarantee.ts — the "Full-Value Delivery Guarantee" that backs EVERY advertiser tier (Tier 1,
- **`funding-pool`** — funding-pool.ts — where the seller cash-back (and other subsidies) are funded from, honestly.
- **`funnel-email`** — funnel-email.ts — turns an AI-concierge recommendation into a COMPLIANT re-engagement email a customer can
- **`gift-boost`** — gift-boost.ts — user-triggered, PLATFORM-funded gift/boost. The compliant alternative to p2p transfers.
- **`giftcards`** — giftcards.ts — the gift-card rail. A clean, closed-loop way to give "shop anywhere" reach: the platform
- **`gifting`** — gifting.ts — closed-loop Site-Cash gifting. A user moves their non-cashable Site Cash (current_balance,
- **`goods-advance`** — Goods Advance — optional, opt-in, CLOSED-LOOP, 0%, NON-RECOURSE in-store advance.
- **`group`** — group.ts — "earn together" groups of a user-chosen size, plus the opt-in path to 1:1 afterward.
- **`group-goals`** — Group Goals — the COMPLIANT "work toward a big-ticket item with friends" engine.
- **`growth-engine`** — growth-engine.ts — the self-sustaining growth flywheel, on REAL cash, with a REDEMPTION RESERVE that
- **`hosting-access`** — hosting-access.ts — the pure gate for "you can host once you've earned your daily minimum." Mirrors the
- **`hosting-monetization`** — hosting-monetization.ts — the pure policy for how a hosted session makes money, and the ONE invariant that
- **`household`** — household.ts — "Family & Teens" accounts, modeled on Amazon Household's teen-login flow.
- **`image-gen`** — Catalog image generation — original product images at effectively-unlimited scale, cheaply.
- **`infra-scale`** — infra-scale.ts — the ACTING scaling adapter. This is what lets a Claude-based agent AUTONOMOUSLY scale the
- **`integrations`** — Replacements for base44.integrations.Core.* — you own the keys, so you control
- **`internal-guard`** — Internal-vs-external call guard.
- **`interstitial-ad`** — interstitial-ad.ts — shared ad selector for the full-screen interstitial placements (between-survey AND
- **`inventory-governor`** — inventory-governor.ts — never sell more advertiser impressions than the live audience can actually serve.
- **`jurisdiction`** — Jurisdiction / state-eligibility engine (Master Plan 0.2).
- **`kyc`** — Know-Your-Customer (KYC) survey — the mandatory FIRST survey a new user completes after their first
- **`language-reference`** — language-reference.ts — reference metadata for the translation agent: an honest estimate of how many
- **`layaway`** — Layaway — reserve a physical item and pay it down with EARNED points BEFORE it ships. No credit is
- **`leaderboard`** — leaderboard.ts — friendly-competition rankings, in two scopes: FRIENDS (your buddies + group) and GLOBAL.
- **`ledger`** — Money-movement audit log + idempotency (Master Plan 0.4).
- **`live-experiments`** — Live experimentation engine — "test a change on real traffic for a window, keep it only if the data
- **`livestream-channels`** — livestream-channels.ts — pure logic for the Omni-Channel Livestream shopping category. The category's
- **`localization`** — localization.ts — the culturalization layer. Beyond translation: when features, products, sales, or services
- **`localize-price`** — localize-price.ts — pure helpers to show shop prices in each user's LOCAL currency for DISPLAY, using the
- **`loyalty`** — Loyalty & Rewards program engine (retail-loyalty reframe) — two-tier, scale-governed, indefinite.
- **`maintenance`** — maintenance.ts — the pure decision core of the site-maintenance agent. Given a HealthSnapshot (plain numbers
- **`marketplace-fee`** — marketplace-fee.ts — third-party seller economics (flywheel #3, the classic Amazon move).
- **`membership`** — Premium membership + points valuation.
- **`messaging-consent`** — TCPA / CAN-SPAM consent + unsubscribe helpers (Master Plan #10).
- **`mod`** — Base44-compatible SDK — drop-in replacement for `npm:@base44/sdk`.
- **`ops-shifts`** — ops-shifts.ts — 24/7 coverage math for the remote operations desk.
- **`optimizer`** — AI self-learning optimization engine.
- **`oversight`** — Human-in-the-loop oversight gate for agent / automation actions.
- **`password`** — password.ts — one place for password hashing + verification, using a slow KDF (bcrypt). Shared by the auth
- **`payout-policy`** — Closed-loop payout policy.
- **`payout-reservation`** — Payout reservation accounting.
- **`paypal`** — paypal.ts — money ROUTING + accounting through the owner's PayPal business account.
- **`paypal-api`** — paypal-api.ts — the LIVE PayPal REST client. Reads credentials from the environment (never from the DB),
- **`personalization`** — Personalization + graduation lifecycle — the login/logout glue for option (b).
- **`pmf-agent`** — pmf-agent.ts — the AI PMF & REVENUE agent.
- **`points-boost`** — Points Boost — a closed-loop, non-cashable "your points grow while you hold them" layer.
- **`premium-adfree`** — premium-adfree.ts — premium members skip ALL ads (between-survey + in-app) for the day by watching ONE
- **`premium-autorenew`** — premium-autorenew.ts — the DEFAULT auto-renewal posture for the consumer PREMIUM membership (owner request),
- **`premium-boost`** — premium-boost.ts — advertiser-funded gift boost for PREMIUM members. An extension of the platform-funded
- **`premium-finance`** — premium-finance.ts — pay for Premium with NO upfront charge, financed out of earnings.
- **`premium-ppc`** — Premium PPC — closed-loop POINTS engine (shared config + helpers).
- **`premium-tier`** — premium-tier.ts — the two ways into Premium and the tier's survey routing.
- **`pricing`** — All-in "landed price" scoring — for the "find the cheapest version of the exact product" search.
- **`product-feeds`** — product-feeds.ts — the DISCOVERY layer. Searches authorized retailer/affiliate product feeds (Amazon
- **`product-stats`** — product-stats.ts — statistical data on ANYTHING sold. Generalizes the funnel benchmark idea to every
- **`provider-advisor`** — provider-advisor.ts — watches REAL hosted-inference spend per capability and recommends flipping to your
- **`providers`** — providers.ts — self-hosted / open-model backends for the swappable AI capabilities.
- **`purchase-signal`** — purchase-signal.ts — makes EVERY marketplace/store purchase visible to the AI / self-learning layer.
- **`queue`** — In-process concurrency limiter + retry/backoff. Wraps provider calls (LLM, email) so
- **`reallocation`** — reallocation.ts — reallocate an unused premium AdGrid slot to a high-value non-premium member.
- **`recurring-billing-compliance`** — recurring-billing-compliance.ts — one shared strict-standard guard for EVERY recurring-charge surface
- **`redemption`** — redemption.ts — per-transaction points SPEND CAP + reserve gate.
- **`referral-invite`** — referral-invite.ts — the COMPLIANT contact-invite referral flow.
- **`referral-model`** — Referral compensation model — AFFILIATE vs MLM.
- **`referral-rewards`** — referral-rewards.ts — the AFFILIATE referral rewards: a one-time activation bonus + an ongoing
- **`referral-tiers`** — referral-tiers.ts — the pure, compliant core of the TWO-TIER referral bonus:
- **`revenue`** — revenue.ts — the platform's non-customer revenue layer.
- **`revenue-coverage`** — revenue-coverage.ts — COMPLETE revenue-stream coverage: every one of the ~45 revenue sub-points across all 8
- **`revenue-levers`** — revenue-levers.ts — the governance registry for EVERY monetization sub-point across all 8 categories.
- **`revenue-stack`** — revenue-stack.ts — the BLENDED $200k/year revenue-stack model, projected over 5 years, per customer.
- **`rls`** — Row-Level Security enforcement for the USER-FACING entity routes.
- **`rtmp-simulcast`** — rtmp-simulcast.ts — pure planning/validation for pushing a hosted livestream to multiple RTMP destinations
- **`rules-first`** — rules-first.ts — the FREE deterministic pre-pass for moderation & classification.
- **`runtime`** — Lets a converted function `export default __handler(async (req) => {...})`.
- **`save-to-get`** — save-to-get.ts — "Save-to-Get" item goal: the no-debt replacement for Goods Advance.
- **`scale-governor`** — scale-governor.ts — the automatic SCALE controller. The mirror image of costFloorProfile: the cost floor
- **`scam-guard`** — scam-guard.ts — protect users in buddy/group chat from the scams a money platform attracts.
- **`seller-activation`** — seller-activation.ts — the seller ⇄ user activation gate for closed-loop cash-back.
- **`service-taxonomy`** — Services taxonomy — the Services-section catalog structure, mirroring the retail TAXONOMY and the
- **`session-capabilities`** — session-capabilities.ts — the pure gate for the optional hosting capabilities a host can turn on per session:
- **`session-capture`** — Sampled, batched session-screenshot capture — the DISCIPLINED version of "capture what the user
- **`session-host`** — session-host.ts — the pure core of Tier-3 "automatic player hosting" (the multiplayer listen-server model
- **`settings`** — Admin settings layer — makes prices, rates, thresholds, and toggles adjustable from the admin
- **`shopping`** — shopping.ts — economics + consent helpers for the opt-in shopping browser extension (Honey-style).
- **`sink-rewards`** — sink-rewards.ts — the self-perpetuating sink loop. When a user makes a closed-loop Site-Cash SINK purchase
- **`site-cash-apply`** — site-cash-apply.ts — automatically apply a buyer's Site Cash to any purchase at checkout.
- **`site-model`** — The site's evolving, Claude-based "model".
- **`sms-optin`** — sms-optin.ts — verifiable SMS marketing consent capture (double opt-in). The front door to the compliant
- **`social-amplification`** — social-amplification.ts — user-amplified social advertising for ALL THREE advertiser tiers.
- **`social-endorser-engine`** — social-endorser-engine.ts — the AI social-post ENGINE for the paid-endorser program.
- **`social-shop`** — social-shop.ts — pure helpers for the AI Social Shop. rankTopSellers aggregates order rows into a ranked
- **`sourcing`** — sourcing.ts — the router that decides HOW a user's order is fulfilled, keeping every path sanctioned.
- **`step-up-auth`** — step-up-auth.ts — server-side STEP-UP AUTH for sensitive actions (the "device proposes, server disposes"
- **`survey-evidence`** — Survey-evidence pipeline helpers.
- **`survey-profile`** — survey-profile.ts — the "CYK" master profile: the LEGITIMATE version.
- **`survey-providers`** — survey-providers.ts — the multi-provider survey supply registry.
- **`survey-reward`** — ─────────────────────────────────────────────────────────────────────────────
- **`survey-suite`** — survey-suite.ts — the end-to-end AI Survey Suite: Pollfish-parity survey creation on the platform's own
- **`survey-test`** — survey-test.ts — pure logic for "survey-test-first": an unsure user validates a product/video idea with a
- **`survey-timing`** — survey-timing.ts — completion-time integrity for surveys.
- **`survey-translate`** — survey-translate.ts — automatic AI translation for surveys (AI-generated AND manually built).
- **`tax`** — Tax / 1099 helpers.
- **`taxonomy`** — Hierarchical product taxonomy — designed to EXCEED a large retailer's browse structure.
- **`telemetry`** — Site interaction telemetry — the lightweight, default-on, ~free capture layer.
- **`tenant`** — tenant.ts — the multi-tenant / rewards-as-a-service seam (flywheel #2).
- **`terms`** — Terms versioning + forced re-consent (Master Plan 0.5).
- **`tier-autorenew`** — tier-autorenew.ts — the DEFAULT auto-renewal posture for Tier 2 & Tier 3 advertiser seats (owner request).
- **`tier-progression`** — tier-progression.ts — the advertiser tier-progression engine: one-tap renewal, and opt-in auto-advance up
- **`tier1-financed`** — tier1-financed.ts — Tier 1 "pay-from-earnings" FINANCED advertising package.
- **`tier1-selfpaced`** — tier1-selfpaced.ts — Tier 1 "Self-Paced" advertising subscription (NO DEBT, not credit).
- **`tier1-value-stack`** — tier1-value-stack.ts — the "$12,000 → $24,000 in advertising value" stack for the Tier 1 / founding offer.
- **`tier2-deposit`** — tier2-deposit.ts — take a full-year (or full-term) deposit UPFRONT for a capacity-paced Tier 2 seat.
- **`tier2-scaling`** — tier2-scaling.ts — Tier 2 "Scale" bought in 30-day PARTS. This is PAY-AS-YOU-GO (each part is a separate
- **`tier2-value-stack`** — tier2-value-stack.ts — the "$200,000 → $400,000 in advertising value" stack for Tier 2 "Scale".
- **`tier3-unlimited`** — tier3-unlimited.ts — "Tier 3 Unlimited": uncapped scaling above the $200,000 Tier 2 base. An advertiser names a budget
- **`transcription`** — Server-side audio/video transcription via OpenAI Whisper (/v1/audio/transcriptions).
- **`translation`** — translation.ts — pure core of the universal translation agent. The heavy lifting (translating into essentially
- **`treasury`** — treasury.ts — solvency / reserve math for the business account.
- **`tts`** — tts.ts — text-to-speech for the voice survey assistant. Reads survey questions aloud so a user can answer
- **`tutorial-content`** — tutorial-content.ts — THE SINGLE SOURCE for both the in-app interactive tutorial and the downloadable
- **`usage-fee`** — usage-fee.ts — the UNIFORM daily platform-usage fee, charged from EARNINGS only.
- **`user-profile`** — Per-user AI + survey data profile.
- **`verified-survey`** — Verified-survey engine — the shared config, consent contract, and AI validity assessment for the
- **`video-autopilot`** — video-autopilot.ts — the pure orchestration core for the end-to-end AI Video pipeline with a human gate.
- **`video-engine`** — video-engine.ts — the admin AI Video Engine core.
- **`video-render`** — video-render.ts — the video RENDER provider abstraction for the AI Video Engine's "render the winners" step.
- **`welcome-credit`** — Welcome Rewards — a non-cashable promotional discount credit granted once per user at signup.

---

## 3. Complete backend function inventory — 983

*Every backend function (HTTP endpoint, scheduled job, or entity-automation), grouped by domain. Each description is sourced from the function's own code header.*

### Extension & Attention Rewards (6)

- **`advertiserExtensionClause`** — advertiserExtensionClause (authenticated advertiser/business) — accept or opt out of the extension-inventory clause of the advertising agreement (B2B, disclosed): the advertiser's campaigns may run on the extension's surfaces. Default posture is eligible (opt-out); the advertiser can opt out. Acc…
- **`extensionAdReward`** — extensionAdReward (authenticated) — credit closed-loop Site Points for one viewed ad on the extension's OWN surface (new-tab / popup). Requires the user to be reward-enrolled (opt-out) and the own-ads layer on. Bounded by the daily + lifetime caps (returns capped:true, credits 0, when a cap is hi…
- **`extensionAdServe`** — extensionAdServe (authenticated) — returns ONE ad creative for the extension's own surface (new-tab / popup) to render. Serves only from campaigns the advertiser made extension-eligible (the disclosed inventory clause); if none are available it returns a HOUSE cross-sell creative (refer / Premium…
- **`extensionAffiliateReward`** — extensionAffiliateReward (INTERNAL/ADMIN — called by the affiliate network's verified conversion postback or a reconciliation job, NOT by an arbitrary client) — records a CONFIRMED affiliate conversion with CLEAN attribution and credits the user's cashback share as closed-loop Site Points. The cl…
- **`extensionConfig`** — extensionConfig (authenticated) — powers the extension's own surfaces + the in-app extension settings. Returns which layers are on, the reward rates, the user's enrollment state, and whether an own-inventory ad can still be rewarded now (caps). No third-party page content and no ads here — config…
- **`extensionEnroll`** — extensionEnroll (authenticated) — record the user's extension state + preferences. Install is the opt-in (marked here when the extension first calls in). Rewards are default-enrolled (opt-out); the browsing Layer B is a separate EXPLICIT opt-in. Tracking opt-in/out is logged in the consent ledger…

### Founding Offer & Tier Progression (24)

- **`autoAffiliateTierProgression`** — 1. Get all affiliate MLM nodes
- **`foundingAdvertiserOffer`** — foundingAdvertiserOffer (authenticated) — the honest terms of the Tier 1 introductory advertising offer + the caller's own status. Read-only. Two things, kept SEPARATE: the advertising PRODUCT you buy, and a standalone survey earn-SHARE membership perk. NOTHING here promises a financial return (s…
- **`foundingAdvertiserSignup`** — foundingAdvertiserSignup (authenticated) — reserve a Tier 1 advertising seat. Clean Tier 1 model: • Records the purchase of an ADVERTISING product (impressions/term/priority) at the introductory price. • Enrolls the buyer as a member with a SEPARATE survey earn-SHARE perk: keep 100% of their OWN …
- **`foundingDataScope`** — foundingDataScope — admin READ of the founding-panel data footprint: the first-party category manifest and, per category, how many signals + distinct users were collected in the window. Proves exactly what is (and isn't) collected — first-party, disclosed categories only, no third-party sharing.
- **`foundingPerksRelease`** — foundingPerksRelease (ADMIN / internal) — release the founding store-credit grant to ACTIVE founding advertisers in equal annual tranches (e.g. 25%/year over 4 years). Store credit is points: closed-loop, non-cashable, spendable only on-site. Safe to run daily/weekly on a schedule; it only releas…
- **`foundingProgramMilestone`** — foundingProgramMilestone (ADMIN / internal) — REPORT-ONLY availability check for the clean Tier 1 offer. Safe to run on a schedule. In the clean Tier 1 model there is NO escrow and NO refund milestone: the presale payment is
- **`foundingRolloverStatus`** — foundingRolloverStatus (read-only) — the caller's founding-advertiser credit picture: • the founding UPGRADE DISCOUNT (a % off the upgrade, decoupled from what they paid) and its window, • a QUOTE for the upgrade with the discount applied (net price), and
- **`foundingSignalRecord`** — foundingSignalRecord — records ONE comprehensive FIRST-PARTY signal for the CURRENT user, into the founding data store the AI model learns from. First-party-only + consent gates live inside recordFoundingSignal, so a disallowed category or a member without founding/PMF consent is a clean no-op (n…
- **`foundingUpgradeQuote`** — foundingUpgradeQuote (read-only) — a QUOTE for the upgrade with the founding-advertiser DISCOUNT applied (a % off the upgrade price, decoupled from what the advertiser paid). Returns the upgrade name, list price, discount, and NET price. NEVER a charge — actual payment for a $200,000 upgrade must…
- **`tier1FinancedAccept`** — tier1FinancedAccept — opt-in origination for the financed Tier 1 package. HARD-GATED: refuses unless the program is live (flag ON + licensed creditor configured + counsel sign-off). Records the advertiser's disclosure consent + earnings-sweep authorization and an approved plan. Because this is RE…
- **`tier1FinancedEligibility`** — tier1FinancedEligibility — read-only. Returns the gate state + this advertiser's eligibility for the financed ($12,000 owed, recourse) Tier 1 package. Returns "not available yet" until the program is live (flag ON + licensed provider + counsel sign-off). Never originates anything.
- **`tier1FinancedTracker`** — tier1FinancedTracker — read-only. If the advertiser has an active financed plan, returns its balance and a projection of the term-end position (including any cash shortfall that would remain OWED, since this is recourse). Informational only — no billing, no charge.
- **`tier1SelfPacedCancel`** — tier1SelfPacedCancel (auth) — pause, resume, or cancel the Self-Paced subscription. Because nothing is ever owed, all three are free and instant: no penalty, no balance, no collections. Canceling/pausing just stops new impressions; whatever was already paid keeps the service it bought.
- **`tier1SelfPacedPay`** — tier1SelfPacedPay (auth) — record a voluntary, buyer-chosen payment toward the Tier 1 Self-Paced package. The buyer picks the amount; benefits accrue in proportion to what they've now paid. NOTHING is owed. This does NOT move money — the actual charge for the chosen amount runs through the normal…
- **`tier1SelfPacedStatus`** — tier1SelfPacedStatus (read) — the Tier 1 Self-Paced (no-debt) subscription status for the caller. Returns the config, the caller's plan status (paid-to-date, delivered impressions, progress toward the optional annual package), and disclosures. amount_owed is always 0 — this is not credit.
- **`tier1ValueStack`** — tier1ValueStack (read-only, public-facing) — the itemized "$12,000 → $24,000 in advertising value" stack for the Tier 1 / founding offer: each included deliverable at its conventional market value, the total delivered advertising value, and the multiple over price. Impression lines are backed by …
- **`tier2AcceptMultiYear`** — tier2AcceptMultiYear (authenticated) — the advertiser VOLUNTARILY opts into the multi-year (up to 5 yr) Tier 2 term in exchange for consideration (locked founding discount / bonus inventory). This is the ONLY thing that makes a results-warranted continuation binding. Requires an explicit, recorde…
- **`tier2BuyPart`** — tier2BuyPart — advance the Tier 2 scale-up by ONE 30-day part. Pay-as-you-go: each part is a separate upfront purchase (NOT credit). Buying the first part starts the plan; each later part requires ≥30 days on the current part AND (if configured) results. The actual charge for the part's net price…
- **`tier2ContinuationStatus`** — tier2ContinuationStatus (read-only) — the caller's multi-year (up to 5) Tier 2 continuation picture: whether last year's real attributed results WARRANT continuing, whether they voluntarily committed to the multi-year term (making a warranted year binding), and whether they may exit. Never charge…
- **`tier2Deposit`** — tier2Deposit (authenticated) — record a full-year (or term) UPFRONT deposit for a Tier 2 seat. This is a PREPAYMENT for advertising delivered over time (the advertiser pays the platform now — not credit). It is earned only as impressions deliver; undelivered impressions at term end are made good …
- **`tier2DepositStatus`** — tier2DepositStatus (read-only) — the caller's deposit delivery picture: how much of the prepaid impression allotment has actually been delivered, how much of the deposit is earned vs still held as unearned revenue, and (at term end, in refund mode) the pro-rata refund owed for anything undelivere…
- **`tier2ScalingStatus`** — tier2ScalingStatus (read-only) — the caller's Tier 2 "Scale" progression: the 30-day part ladder, which part is next, whether the 30-day + results gates are met, and the discount that applies right now (6% in the first year for anyone; perpetual for founding members). Never charges.
- **`tier2ValueStack`** — tier2ValueStack (read-only, public-facing) — the "$200,000 → $400,000 in advertising value" stack for Tier 2 "Scale": the full A–D rate card at conventional market rates, the total delivered advertising value, and the multiple over price. Impression lines are backed by the delivery guarantee. Thi…
- **`tier3UnlimitedQuote`** — tier3UnlimitedQuote (read-only, public-facing) — quote a "Tier 3 Unlimited" package for a given budget at/above the $200k Tier 2 base. Deliverables + advertising value + guaranteed impressions scale proportionally from the A–D rate card (same ~2× value ratio). Delivery is capacity-paced and prepa…

### Video, Media & Creative Engine (20)

- **`aiCreativeContentGeneator`** — Fetch market trends and competitor content
- **`aiCreativeSuiteExperiment`** — aiCreativeSuiteExperiment — launch an A/B (or, for eligible tiers, multivariate) test from generated CreativeAsset variants. Tier-gates concurrency and multivariate. Creates an AdCreativeTest row linking the assets with an even traffic split; the existing autoABTestWinner / trackABTestMetrics loo…
- **`aiCreativeSuiteGenerate`** — aiCreativeSuiteGenerate — the "generate" step of the AI Creative Suite. One brief → compliant, brand-aligned variants across every requested ad format, biased by the advertiser's self-learning playbook, each compliance-screened and given a predictive score, then persisted as CreativeAsset rows. W…
- **`aiCreativeSuiteLearn`** — aiCreativeSuiteLearn — the self-learning / self-improving step. Reads the advertiser's creative tests, turns each arm's real performance into signed learning signals (recordCreativeOutcome → OptimizationSignal + AgentLearningMemory), rebuilds the playbook, and returns recommendations + the next-g…
- **`aiCreativeSuiteStatus`** — aiCreativeSuiteStatus — the AI Creative Suite dashboard payload for an advertiser: their tier capabilities, quota, active experiments, the learned playbook (top attributes + recommendations), and any fatigued creatives that are due for a refresh.
- **`aiVideoAutopilotApprove`** — aiVideoAutopilotApprove — the HUMAN GATE. Given a run parked at "awaiting_render_approval", the owner: • approves → render the selected winners (optionally a tweaked subset via concept_ids) • rejects → cancel the run (nothing renders)
- **`aiVideoAutopilotStart`** — aiVideoAutopilotStart — kick off one end-to-end run. Runs the CHEAP, reversible stages automatically by reusing the existing functions in-process: refresh live trends → generate concepts → build a user poll. It then parks the run in "collecting" (gathering votes). aiVideoAutopilotTick later advan…
- **`aiVideoAutopilotStatus`** — aiVideoAutopilotStatus — the autopilot dashboard: recent runs, the run(s) waiting for approval (with their candidate winners for the UI), and the TRUST meter showing how close the system is to earning full autonomy (so the human gate eventually comes off on its own). Admin only.
- **`aiVideoAutopilotTick`** — aiVideoAutopilotTick — advance in-flight runs. For each "collecting" run whose poll is ready (enough votes, or waited long enough), it: learns from the poll, SELECTS the render winners within budget, then either (a) auto-approves + renders when the system has EARNED autonomy, or (b) parks at the …
- **`aiVideoEngineGenerate`** — aiVideoEngineGenerate — the CHEAP, phased "generate concepts" step. Samples the concept space (ε-greedy, biased by the self-learning playbook), grounds each concept in a live trend (news-jacking), builds a templated micro-brief, screens it for compliance, and gives it a 0–100 predictive score — a…
- **`aiVideoEngineIngestMetrics`** — aiVideoEngineIngestMetrics — feed a rendered/tested video's REAL, quantifiable metrics back in. Computes the video's blended performance, scores it relative to its batch mean, records a signed learning signal (so the playbook promotes/demotes its dimension values), and updates the VideoConcept ro…
- **`aiVideoEngineLearn`** — aiVideoEngineLearn — rebuild the self-learning video playbook from all recorded outcomes and return the winning value per dimension plus plain-language recommendations. The generator reads playbook.top to re-bias the next sample, so calling this makes the next batch smarter. Admin only.
- **`aiVideoEngineRefreshTrends`** — aiVideoEngineRefreshTrends — refresh the live trend pool that grounds concepts (Mint-Mobile-style news-jacking). Providers: • "auto" — SEARCH THE INTERNET: fetch Google-Trends daily trending searches (real, current, no API key),
- **`aiVideoEngineRenderWinners`** — aiVideoEngineRenderWinners — the PHASED spend gate. Takes the top-scoring compliant concepts, up to the daily render count AND the daily $ cap, writes each a real script + storyboard (and a thumbnail if images are on), and marks them rendered/queued. If the render provider is "none" (default), it…
- **`aiVideoEngineStatus`** — aiVideoEngineStatus — the admin dashboard payload: the size of the concept space, today's budgets and how much remains, the leaderboard (top concepts by predictive score, and tested ones by measured performance), the self-learning playbook + recommendations, and trend freshness. Admin only.
- **`buddyVoiceClip`** — buddyVoiceClip (authenticated) — fetch a voice clip for playback, TRANSLATED into the listener's language when it differs from the speaker's. The listener gets: the original audio, a translated transcript, and (premium, if ElevenLabs is configured) a spoken translation they can hear in their own …
- **`buddyVoiceMessage`** — buddyVoiceMessage (authenticated) — hands-free voice, but ONLY between two buddies who mutually CONNECTED (the opt-in connect). The clip is transcribed (Whisper), the transcript runs through the answer-wall + anti-scam guard (so voice can't smuggle answer-sharing or scams past text moderation), a…
- **`shoppingPurchaseIngest`** — shoppingPurchaseIngest (authenticated) — records ONE purchase the opt-in shopping extension observed and credits the user's cashback share as closed-loop Site Cash. This is the app-side endpoint; the extension (which needs affiliate partnerships + store review + a privacy review) posts to it.
- **`ttsSpeak`** — ttsSpeak (authenticated) — read a survey question aloud for the voice assistant (available to ALL tiers). The paid ElevenLabs voice is a PREMIUM perk by default; non-premium gets the device's built-in voice (free) — flip TTS_ELEVENLABS_FOR_NONPREMIUM to give everyone the ElevenLabs voice. The use…
- **`videoRenderStatus`** — videoRenderStatus — read-only: the active video render provider, its config + daily caps, whether it's configured (has its key/endpoint), and the comparison across all providers (none / Abacus aggregator / serverless GPU). Admin only. Moves/renders nothing.

### Surveys & Earning Loop (143)

- **`adGridAnswer`** — adGridAnswer (authenticated) — the user answered a thumbnail's questions (incl. Option E interest). We: 1) record the response (suppresses the product if not interested), 2) append the answers to the user's plaintext product profile (AI-usable),
- **`adGridEndSessionLinks`** — adGridEndSessionLinks (authenticated) — at logout / session end, return the product links from the thumbnails the user engaged today, for the "want to visit these products?" prompt. Only products they were interested in (Option E != no) are surfaced.
- **`adGridFeed`** — adGridFeed (authenticated) — the daily grid of thumbnails. Premium users always get it; non-premium users get it from the non-reserved slice (or with a reallocated slot), else they're told to use BitLabs. Each thumbnail carries its 2 questions + the permanent Option E interest question.
- **`adGridReallocateSlots`** — adGridReallocateSlots (INTERNAL/ADMIN, scheduled) — reallocate unused premium AdGrid slots to the best non-premium earners for the day. Premium members with no earning activity today are treated as no-shows; their slots are granted to consistent, engaged non-premium users (a one-day AdGrid pass).…
- **`adGridSessionStatus`** — adGridSessionStatus (authenticated) — today's AdGrid session progress (thumbnails done, gross, complete?).
- **`aiAgentLearningSystem`** — Store learning memory entry
- **`aiAppCategoryImages`** — aiAppCategoryImages (INTERNAL/ADMIN, scheduled) — spins up ORIGINAL App Store category tiles on the serverless GPU, ONCE per category, exactly like the retail aiCategoryImages. Top categories first, then subsections. Stored in CatalogCategory { name, level, image_url, kind:"app" } so they don't
- **`aiAutoLearningOrchestrator`** — Master orchestration of ALL AI learning systems
- **`aiAutomationLearningEngine`** — ── 1. RECORD a single automation run ──────────────────────────────
- **`aiConceptPollCreate`** — aiConceptPollCreate — turn auto-generated video CONCEPTS into a user poll. Pulls a pool of the top recent compliant concepts (or a supplied concept_ids list), builds balanced head-to-head / MaxDiff matchups, and persists a ConceptPoll (status "open"). Users then vote via aiConceptPollNext/Vote, a…
- **`aiConceptPollLearn`** — aiConceptPollLearn — turn a poll's results into learning signals for the SAME video playbook: each concept's preference score (relative to the poll mean) becomes a signed weight on its creative dimensions, recorded via recordVideoOutcome. So "users preferred the question-hook, current-event conce…
- **`aiConceptPollNext`** — aiConceptPollNext — serve the current user the next matchup to vote on. Picks the newest open poll (or a given poll_id), skips matchups this user has already voted on (sequential), and returns the concept previews for the set. Any signed-in user. Returns { done: true } when the user has voted on …
- **`aiConceptPollResults`** — aiConceptPollResults — tally a poll's votes into a MaxDiff/head-to-head ranking of which concepts poll higher, joined with each concept's creative attributes. Admin only.
- **`aiConceptPollVote`** — aiConceptPollVote — record one user's vote on a matchup: { poll_id, set:[ids], best, worst? }. For a head-to-head (set of 2) only `best` is needed — the other is the implied loser. Persists a ConceptPollVote and bumps the poll's vote counter. Any signed-in user. Idempotent-ish: re-voting the same…
- **`aiDevPreLaunchSurvey`** — AI generates a tailored pre-launch feedback survey
- **`aiDeveloperFeedbackSurvey`** — Gather existing user data for context
- **`aiFeatureLearningFramework`** — Store learning record for all AI features
- **`aiSurveyAutoDistribute`** — Scheduled: runs every hour to auto-distribute surveys to matched users
- **`aiSurveyGenerator`** — Generate survey questions using AI
- **`aiSurveyHeatmapAnalyzer`** — Fetch UX session recordings for this survey
- **`aiSurveyInsightsDashboard`** — Find business client for this user
- **`aiSurveyLaunchOptimizer`** — Fetch historical response data for pattern analysis
- **`aiSurveyMatchEngine`** — Gather context
- **`aiSurveyMatcher`** — AI matches users to the most relevant surveys by profile and behavior.
- **`aiSurveyRecommendationEngine`** — Enrich recommendations with full survey data
- **`aiSurveySuiteEdit`** — aiSurveySuiteEdit — apply one AI or deterministic edit op to a question in a SurveyDraft. AI ops (reword/expand/shorten/change_tone/spellcheck/translate) run through the LLM; deterministic ops (shuffle_options/add_option/remove_option/add_neutral/change_type/undo) run in code. Keeps an undo history.
- **`aiSurveySuiteGenerate`** — aiSurveySuiteGenerate — prompt/goal/topic → a full professional survey with varied question types, or paste an existing survey to restructure it into the builder. Quality- and compliance-screened, scored, biased by the self-learning playbook, persisted as a SurveyDraft. (Pollfish-parity generatio…
- **`aiSurveySuiteLearn`** — aiSurveySuiteLearn — the self-learning step. Turns a fielded survey's completion into signed learning signals per question attribute (type / position / length), rebuilds the playbook, and returns the next-survey guidance the generator should favor.
- **`aiSurveySuiteMethod`** — aiSurveySuiteMethod — generate an advanced research-method block (A/B, conjoint, MaxDiff, Van Westendorp, Gabor-Granger) and optionally append it to a SurveyDraft.
- **`aiSurveySuiteReport`** — aiSurveySuiteReport — AI Reports: read a survey's questionnaire + responses, tally closed questions, code open-ended answers into themes, and draft an evidence-based summary with recommendations. (Pollfish-parity AI Reports on our own response data.)
- **`aiSurveySuiteStatus`** — aiSurveySuiteStatus — the Survey Studio dashboard: what's enabled, the question-type palette, advanced methods, locales, recent drafts, and the live self-learning playbook + recommendations.
- **`aiSurveyUXLearningEngine`** — Get all survey UX session recordings from past 7 days
- **`analyzeFeedbackSurvey`** — Get the survey
- **`appStoreEarningsValidator`** — Check today's earnings
- **`applyApprovedLearnings`** — Fetch all approved, active memories not yet widely applied
- **`auditSurveyResponses`** — ── SCAN ──────────────────────────────────────────────────────────────
- **`autoAgentLearningCycle`** — Weekly: analyze AgentPerformanceLog, generate learnings, update AgentLearningMemory
- **`autoGameVoteSurveyLifecycle`** — Scheduled daily: close expired GameVoteSurveys and apply results
- **`autoLearningDataCollector`** — List of all major engine functions to collect data from
- **`autoMLMEarningsAggregation`** — DEPRECATED under the AFFILIATE model. Downline earnings aggregation is a multi-level concept that no longer applies — affiliates earn a single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer does anything.
- **`autoPPCSurveyResponseLifecycle`** — Credit earnings to respondent
- **`autoSurveyDisputeLifecycle`** — AI analyze survey dispute
- **`autoSurveyLifecycleEngine`** — Automates: survey creation, scheduling, distribution, quality scanning, scoring, health monitoring
- **`autoSurveyResponseInsights`** — Fetch recent survey responses awaiting analysis
- **`autofillSurveyFromTranscript`** — autofillSurveyFromTranscript — map a respondent's spoken/typed answer onto the survey's questions, producing PROPOSED answers the respondent then reviews and confirms. NEVER submits, NEVER pays out — it only suggests; the respondent stays in control and can change any answer.
- **`capturePayPalSurveyOrder`** — Record the transaction
- **`chargeMissedSurveyDays`** — chargeMissedSurveyDays — DISABLED under the no-penalty model. Missed days are NEVER charged. A missed day simply doesn't earn — there is no debt and nothing to collect. This endpoint no longer creates any Stripe charge or negative transaction; it exists only
- **`chargeSurveyCreation`** — Create and confirm a PaymentIntent immediately
- **`checkSurveyFraud`** — 1. Resolve IP geolocation & proxy/VPN detection via ipapi.co (free tier). CACHED by IP (24h) — the same IP is otherwise re-queried on every survey submission, which burns the free-tier quota. A shared Redis (REDIS_URL) makes the cache cross-instance; otherwise in-memory.
- **`createAdGridAd`** — createAdGridAd (authenticated advertiser) — create a PPC AdGrid ad: a product thumbnail + 2 survey questions (A-D options) + a product page (name, image, Buy Now). The advertiser writes it by hand, or sets ai_generate:true and we draft the questions + product-page copy from a prompt.
- **`createPPCSurvey`** — Languages the business chose to auto-translate this survey into (BCP-47 codes or labels).
- **`createPayPalSurveyOrder`** — Creates a PayPal order for a survey/advertiser purchase (live api-m.paypal.com).
- **`dailyAISurveyGenerator`** — Generate today's survey with AI
- **`earnAdReward`** — earnAdReward (authenticated) — credit closed-loop Site Points for ONE COMPLETED, USER-INITIATED in-app rewarded ad. This is called by the app AFTER the ad SDK reports a genuine completed rewarded view (the ad is never auto-played — the user chose to watch it). The grant is bounded by the daily + …
- **`earnBackAbandon`** — earnBackAbandon (authenticated) — the member abandons an item mid-plan. The unearned portion they prepaid converts to non-expiring Site Cash (closed-loop, spendable on-site), NOT a refund to a card and NOT forfeited. Discount already earned stays earned. Site Cash issued here is non-expiring by p…
- **`earnBackCredit`** — earnBackCredit (internal/admin) — apply completed survey minutes toward a member's active earn-back plan. Called by the survey-completion flow. Credits Site Cash (closed-loop points), advances the plan, and for PREMIUM records the subsidy + the global monthly kill-switch counter. Enforces: per-it…
- **`earnBackPrefs`** — earnBackPrefs (authenticated) — set the member's stay-on-track prefs for one ownership plan: daily reminders and/or lockout mode. Lockout mode means the member's phone opens at their set time each day and stays locked until they complete that day's survey minutes toward their chosen % ownership —…
- **`earnBackStart`** — earnBackStart (authenticated) — begin a Prepay & Earn-Back plan on ONE item. The member has PREPAID the item plus a "portion" equal to the discount they choose to earn back; this records the plan they then earn down by completing surveys. It's a closed-loop REBATE (paid first, no credit, no defau…
- **`earnBackStatus`** — earnBackStatus (authenticated) — the member's earn-back dashboard: their active/recent plans as PERCENTAGES + survey minutes (no dollars lead), progress, grace days left, and whether earning is paused (missed too many days). Also returns the current premium price (founding vs sustainable) and, fo…
- **`earnHookConfig`** — earnHookConfig (authenticated) — powers the earn-hook widget feed + the in-app settings/earn screen. Returns the user's Site-Cash balance, streak, whether a rewarded ad can still be earned right now (caps), the user's hook/reminder preferences, and whether the end-of-session offer may be shown. R…
- **`earnHookOfferSeen`** — earnHookOfferSeen (authenticated) — the app calls this when it SHOWS the end-of-session "earn extra today?" offer, so the server can enforce the frequency cap (EARN_HOOK_OFFER_MIN_GAP_HOURS) and not over-show it. Optionally records the user's response (dismissed) so a repeatedly-dismissed offer c…
- **`earnHookSetPrefs`** — earnHookSetPrefs (authenticated) — the user sets their hook preferences: "open straight to earn" (the widget one-tap option), and the daily earn reminder opt-in + the time THEY pick. Opting into the reminder is logged in the consent ledger (a requested-reminder record). Turning the reminder off i…
- **`earnRateDisclosure`** — earnRateDisclosure (public read) — the earning-screen disclosure of the platform hold on GROSS survey revenue (the "marketplace-equivalent" line). The Terms say this percentage "will be shown on the earning screens"; this endpoint is that source of truth, read live from settings so it can't drift.
- **`earnedAdvertiserJoin`** — earnedAdvertiserJoin (authenticated) — opt into the FREE earn-to-unlock advertiser tier, or the no-upfront (participation-term) Tier 1 option. NOTHING is owed in either mode. Requires explicit acceptance of the honest disclosures. Never moves money; never creates a balance.
- **`earnedAdvertiserLedger`** — earnedAdvertiserLedger (ADMIN / internal) — the OPERATOR-ONLY view of internal value realization toward the ~$8,000 LTV target across earned/no-upfront members. This is the "$5 per referral knocked off the $8k" tracking. It is NEVER exposed to customers (guarded to internal/admin only).
- **`earnedAdvertiserSync`** — earnedAdvertiserSync (authenticated, self) — recompute the caller's activity and GRANT any newly-unlocked advertiser benefits. Idempotent. NEVER charges, NEVER reverses, NEVER creates a balance. Safe to call after a survey completion or on a schedule.
- **`earningVelocityMonitor`** — Fetch all user responses + current survey in parallel
- **`earningsSetAsideMoveNow`** — earningsSetAsideMoveNow (auth) — the user voluntarily moves a chosen amount of their CURRENT spendable Site Cash into their set-aside bucket right now. Just re-buckets their own money; nothing owed, reversible. Body: { amount_usd }
- **`earningsSetAsideRelease`** — earningsSetAsideRelease (auth) — move money from the set-aside bucket BACK to spendable. Proves the "nothing is locked" promise: the user can reclaim any or all of it at any time, no penalty, no balance. Body: { amount_usd?, all? } — omit amount_usd + all:true to release the whole bucket.
- **`earningsSetAsideSetPct`** — earningsSetAsideSetPct (auth) — the "button" action: the user chooses how much of their FUTURE earnings to set aside. 0 turns it off (the default). Accepts 0..1 or 0..100. Stores the preference on the user; it takes effect as new earnings are credited. Never moves existing money and never owes an…
- **`earningsSetAsideStatus`** — earningsSetAsideStatus (read) — the caller's set-aside preference + bucket balance + spendable balance. amount_owed is always 0: this is the user's own closed-loop Site Cash, re-bucketed by their own choice.
- **`earningsWhatIf`** — earningsWhatIf (auth) — compute the caller's OWN what-if scenario from their history + their inputs. Makes no platform claim; every result carries the "not a prediction/promise" disclaimer. Body: { target_usd?, minutes_per_day?, days? }
- **`generateAISurvey`** — Languages the creator chose to auto-translate the survey into (BCP-47 codes or labels).
- **`generateDailyFeedbackSurvey`** — Check if today's survey already exists
- **`generateMockupVoteSurvey`** — Check if already exists
- **`generatePricingSurvey`** — generatePricingSurvey (INTERNAL/ADMIN, scheduled) — the AI WRITES price-research surveys to grow the pricing dataset. It asks the LLM for a short Van Westendorp / Gabor-Granger question set about a target product or feature, then creates a Survey (type "pricing_research") that the app can serve
- **`generateProductSurveyWithLinks`** — AI-generate 5-question survey with product link embedded
- **`generateWeeklyFeatureVoteSurvey`** — Creates the weekly, mandatory, $0.10 feature/game vote survey from the top user suggestions, and notifies active users. Intended to run once per week (e.g. Monday) via a schedule or the feature_vote_growth_agent.
- **`getBitLabsSurveyUrl`** — BitLabs survey wall URL - uses your API token and a unique user identifier The uid should be unique and consistent per user (we use their DB user ID)
- **`getPersonalizedSurveys`** — Returns personalized survey task cards ranked by user demographics + completion history
- **`getSurveyProfile`** — getSurveyProfile (authenticated) — the user's CYK master profile (screening answers only) + how complete it is. Used to render the profile form and to feed the provider profiler. Read-only. Body: {} → { answers, completeness, screening_keys }
- **`getTodayFeedbackSurvey`** — Get today's active survey
- **`kycSurveyAISuggest`** — kycSurveyAISuggest (ADMIN) — the AI proposes an IMPROVED KYC survey, grounded in the real distribution of past answers (which questions actually discriminate, which options nobody picks, gaps to fill for better personalization). By default the proposal is STAGED for a human to approve (kycSurveyP…
- **`kycSurveyAdminGet`** — kycSurveyAdminGet (ADMIN) — everything the KYC-survey editor needs: the ACTIVE survey members see, the built-in DEFAULT (to reset to), and any pending AI PROPOSAL awaiting approval.
- **`kycSurveyAdminSave`** — kycSurveyAdminSave (ADMIN) — a HUMAN manually adjusts the KYC survey. Validates the submitted survey, makes it the live active survey (what new members see), and records an audit-log entry. Body: { survey } OR { reset: true } (reset to the built-in default)
- **`kycSurveyGet`** — kycSurveyGet (authenticated) — returns the Know-Your-Customer survey plus this user's status: whether they still MUST complete it (mandatory first survey) and the non-cashable reward on offer. The frontend gate uses `required` to block the app until the survey is submitted.
- **`kycSurveyProposalDecide`** — kycSurveyProposalDecide (ADMIN) — approve or reject the pending AI-proposed KYC survey. Approving makes it the live active survey; rejecting discards it. This is the human review gate on AI adjustments. Body: { action: "apply" | "reject" }
- **`kycSurveySubmit`** — kycSurveySubmit (authenticated) — save the user's KYC answers, grant the one-time non-cashable reward (tops up the welcome-rewards pool; per-order cap + expiry apply), and emit a domain event so the personalization + self-learning layers pick up the new interest signals. Idempotent: submitting
- **`learnFraudPatternsAI`** — Fetch flagged transactions/activities for analysis
- **`learningDistill`** — INCREMENT 2 — Shared cross-agent learning. Reads the raw learning data every agent produces (AgentLearningMemory), the cost/usage meter (AgentPerformanceLog), and the survey-driven signals (SurveySignal), then DISTILLS:
- **`learningInsights`** — INCREMENT 5 — Learning insights for the dashboard. Per-agent success trends + the latest platform insight + recent lessons (with veto/pin status) so a human can see what the agents are learning and step in.
- **`learningOverheadMonitor`** — learningOverheadMonitor (INTERNAL/ADMIN, scheduled) — the safeguard that keeps the measurement/ self-learning system from ever becoming the cost. It watches its OWN footprint (telemetry volume, metric-event volume, snapshot volume, and AI spend) and auto-throttles within bounds:
- **`notifyNewSurveyMatch`** — Entity automation: triggered when a PPCSurvey is created/activated
- **`notifyWeeklyTopEarners`** — Self-hosted app URL (replaces the dead base44.app domain). Set APP_URL in your env.
- **`ppcNetworkCapacity`** — ppcNetworkCapacity — how many users the PPC earning network can hold, computed 1:1 from the number of BUSINESSES that have paid the $5,000 grid price. One user slot per paying business. capacity = paying businesses (ppc_grid_active)
- **`premiumPPCAutoAdvertise`** — premiumPPCAutoAdvertise (INTERNAL/ADMIN, scheduled) — the AI advertising engine for the PPC network. For each PAYING advertiser that hasn't yet DOUBLED their investment (received ≥ $10k in orders), the AI writes an ad for their product and QUEUES it as a #ad-disclosed SocialMediaPost on the accou…
- **`premiumPPCDailyReconcile`** — premiumPPCDailyReconcile — runs once/day (scheduler, service token). NO-PENALTY model with legal engagement boosts: • On an ACTIVE day the member earns a premium BOOST on top of their normal activity —
- **`premiumPPCEnroll`** — premiumPPCEnroll — a user joins the (free) Premium PPC program. NO-PENALTY MODEL: enrollment requires explicit T&C consent. A card on file is now OPTIONAL and is NEVER used to charge for missed days (there are none) — the user earns points as they go and owes
- **`premiumPPCOffer`** — premiumPPCOffer (public) — the advertised offer, in REAL DOLLARS, plus the point equivalents and the required disclaimer. Advertise the $ figures; disclose that value is delivered as closed-loop points (1¢ each) spendable at any store through the site — NOT withdrawable as cash.
- **`premiumPPCRequestAdvance`** — premiumPPCRequestAdvance — DEPRECATED under the no-penalty points model. There is NO upfront advance/disbursement anymore. (An upfront advance repaid over time is exactly what created the lending/credit risk.) Points are EARNED as you go — up to $4/day, capped at the
- **`premiumPPCSetLockoutTime`** — premiumPPCSetLockoutTime (authenticated) — the up-front member sets/updates their daily lockout-mode window: the local time each day they'll be reminded to complete their ~8-minute survey commitment. This is an IN-APP focus/reminder mode (a web/native PWA can't lock the whole phone), so it schedules
- **`premiumPPCStatus`** — premiumPPCStatus — membership + earn-as-you-go ledger for the UI, plus the 1:1 slot availability. NO-PENALTY MODEL: shows POINTS EARNED and opportunity remaining (a positive tracker) and the count of active vs. missed days. There is no debt, no "amount owed", and nothing to collect.
- **`premiumPPCSurveyDay`** — premiumPPCSurveyDay (authenticated) — credit the member's survey progress for TODAY. Called by the survey-completion flow. Supports MAKE-UP: pass the day's cumulative `minutes` and extra minutes credit multiple sessions (each = ~8 min) to catch up missed days — one make-up session per day
- **`processPPCGridSubscription`** — Plan config
- **`processPPCSession`** — Earnings per tier
- **`processSurveySchedules`** — Scheduled automation: runs every 5 minutes to check for surveys to launch
- **`publishWinningSurveyProduct`** — Publishes the winning concept-poll survey result as a live store product.
- **`purchaseEarnBoost`** — purchaseEarnBoost (authenticated) — buy a TIME-LIMITED Site-Cash earn multiplier with Site Cash. Deterministic (fixed step, fixed window, known price — NOT a random/paid draw, not a loot box, not gambling). The purchase is a closed-loop Site-Cash SINK (booked as `breakage`); the boost only ever s…
- **`rankSurveysForUser`** — Gather all context in parallel
- **`recommendSurveys`** — Get user's completed surveys and interests
- **`runSurveyIntelligence`** — Backend function: analyze all survey data and auto-apply improvements
- **`saveSurveyProfile`** — saveSurveyProfile (authenticated) — save/update the user's "CYK" master profile: their stable demographic/screening answers. Input is SANITIZED to the finite screening whitelist — any non-screening (substantive) key is silently dropped, so this file can never hold survey content. Upserts one profile
- **`scheduleSurveyDistribution`** — Send email confirmation to the survey creator
- **`scoreSurveyResponse`** — 1. Completion penalty
- **`selfLearningCycle`** — selfLearningCycle (INTERNAL/ADMIN, scheduled) — the master self-improvement pass. It closes the loop the product asks for, reusing the engines already in the repo: 1. COLLECT + ANALYZE → aggregateStats() rolls interaction telemetry into funnel/scroll/drop-off
- **`sendPPCAdNotification`** — Get user's push subscriptions
- **`sendSurveyNotifications`** — Self-hosted app URL (replaces the dead base44.app domain). Set APP_URL in your env.
- **`sendSurveySmsReminder`** — Fetch all users (service role for scheduled task)
- **`setSurveyCommitment`** — setSurveyCommitment (authenticated) — the user picks the daily time they'll do their $8 of surveys, plus their timezone offset. Stored on the User; drives the daily nudge + streak. Body: { hour: 0-23, tz_offset_minutes?: number }
- **`submitVerifiedSurveyResponse`** — submitVerifiedSurveyResponse — the authoritative submit for a VERIFIED (voice/video) PPC survey. The respondent has already recorded, transcribed, and CONFIRMED their answers on the client; this creates the response and runs the whole chain server-side so nothing can be skipped:
- **`superAgentSurveyOps`** — === HEALTH & QUALITY ===
- **`surveyABTestOptimizer`** — Simple z-test for proportions
- **`surveyAlertEngine`** — Checks for high-paying matching surveys and sends alerts to eligible users
- **`surveyAnalyticsAI`** — AI analytics over survey responses (themes, sentiment, quality).
- **`surveyCommitmentReminder`** — surveyCommitmentReminder (INTERNAL/ADMIN, scheduled) — the daily nudge engine. For each user with a commitment: if their time has come and they haven't hit the $8 goal, drop a reminder notification. And award a streak bonus (once per day) when a user reaches a streak milestone. Bounded scan; App-…
- **`surveyCommitmentStatus`** — surveyCommitmentStatus (authenticated) — drives the daily nudge UI: today's progress toward the $8 goal, whether the (dismissible) prompt should show, the user's chosen time, and the current streak.
- **`surveyHealthMonitor`** — Allow both admin-triggered and scheduled (no user context)
- **`surveyIngest`** — Survey-evidence pipeline. Reads recent survey responses, quality-gates each (reusing the existing scoreSurveyResponse scorer where available), writes a normalized SurveySignal for the ones that pass, marks the response processed, and emits a survey.signal.created event
- **`surveyInterstitialGate`** — surveyInterstitialGate (authenticated) — the mandatory ~30s ad BETWEEN surveys for non-premium users (flywheel #3 addition). Premium is exempt (an upgrade incentive). The ad is served from your OWN inventory (AdGrid / sponsored slots), so the impression feeds your ad revenue (flywheel #1) instead…
- **`surveyProviders`** — surveyProviders (authenticated) — the survey networks available to this user, with configured status. More enabled+configured networks = more survey supply = more earning hours. Read-only.
- **`surveyQualityAutoScan`** — Get recent responses that haven't been quality-scored yet
- **`surveyQualityMonitor`** — If no survey_id, run bulk scheduled mode across all active surveys
- **`surveyRoute`** — surveyRoute (authenticated) — where should this user be sent for surveys right now? Premium and users holding a reallocated slot get AdGrid (high-paying, own inventory); non-premium get AdGrid from the non-reserved slice under their daily cap, else fall back to BitLabs. Read-only.
- **`surveyScreenOut`** — surveyScreenOut (authenticated) — a survey disqualified the user mid-way. Grant a small consolation credit so wasted time still earns a little (keeps engagement), up to a per-user DAILY CAP. This is the only cash outflow in the earn-parity package, so it's platform-subsidized and ledgered via rec…
- **`surveyStreakReminder`** — Scheduled function: detects users inactive 24+ hours and sends personalized streak reminders
- **`surveyTestCreate`** — surveyTestCreate — "Test it first." An unsure user creates a FREE validation survey to gauge whether a product or video idea will land, before committing to sell or host. Free to create; respondents complete it as a standard advertiser-funded PPC survey and keep the full Site-Cash reward (nothing…
- **`surveyTestResults`** — surveyTestResults — the "will it sell?" read for a validation survey. Aggregates responses into interest, purchase intent, expected price, and comments, plus a plain signal (strong / mixed / weak / insufficient). Explicitly FEEDBACK, never a guarantee. Only the survey's creator (or an admin) can …
- **`surveyTranslate`** — surveyTranslate (authenticated) — translate an EXISTING survey into languages the creator selects later, using the same neutral, structure-preserving translator as the AI and manual creators. Only the survey's owner (or an admin) can translate it. Gated behind AUTO_TRANSLATE_ENABLED + SURVEY_AUTO…
- **`surveyUXFraudAnalyzer`** — ── RECORD ────────────────────────────────────────────────────────────
- **`surveyWidget`** — ── GET /widget.js ── serve the embeddable JS loader
- **`transcribeSurveyAudio`** — transcribeSurveyAudio — transcribe a respondent's spoken answer for a VERIFIED PPC survey. DATA MINIMIZATION: the raw voice/video is NEVER stored. If the phone transcribed on-device (free Web Speech API) the audio isn't even uploaded; otherwise the audio is used ONLY to run Whisper in memory and
- **`translateSurvey`** — Auto-translates a survey into the user's language.
- **`verifiedSurveyConsent`** — verifiedSurveyConsent — the biometric/capture consent gate for verified (voice/video) surveys. Body: { action: "status" | "accept", method?: "voice"|"video"|"screen" } status → which of the required consents this user currently has, + the disclosure to show

### Advertiser & Ad Marketplace (25)

- **`adAutoCounterBid`** — Scheduled: runs every 6 hours to check if competitors have outbid any active ads and auto-bumps bids for advertisers who have counter-bidding enabled
- **`adAutoReviewer`** — Triggered by entity automation when a new AdListing is created with status=pending
- **`adCampaignHealthDigest`** — Get all advertisers with active/paused ads
- **`adSentimentScanner`** — Allow scheduled (no-user) execution; still check if called manually
- **`advertiserApplyInfo`** — advertiserApplyInfo (public read) — the content for the /Apply page: the prominent Founding Advertiser (Tier 1) offer with its live benefits + availability, and the three financing options with their real gate status (all "coming_soon" until a licensed provider + counsel sign-off flip them live).…
- **`advertiserCancel`** — advertiserCancel (auth) — the 30-day PROPORTIONAL cancellation (cooling-off) for any advertiser tier. Within the window we keep two-thirds and refund one-third of what was paid, issued as CLOSED-LOOP site refund credit (never cash/card — that path stays gated). Independent of the Full-Value Deliv…
- **`advertiserFeatureCatalog`** — advertiserFeatureCatalog — read the TIERED advertiser feature catalog: every advertiser-facing revenue stream as an add-on feature, mapped to Tiers 1–3, with its conventional value and readiness. Also returns the per-tier rollup showing how much delivered value the live features ADD (holding the …
- **`advertiserPerformance`** — advertiserPerformance (auth, read-only) — the on-demand advertiser dashboard read. Returns the conventional PPC metric set (impressions, clicks, CTR, CPC, conversions, CPA, revenue, ROAS/ROI) + social/engagement attribution for the CALLER, computed from real activity, plus the benchmark compariso…
- **`advertiserProgressionStatus`** — advertiserProgressionStatus — the "see your results → Agree" screen. Returns the advertiser's MEASURED results and whether they're at a term boundary with an option to renew (same tier), auto-advance (if opted in and the measured ROI threshold is met), or complete (year caps reached).
- **`advertiserProgressionSweep`** — advertiserProgressionSweep — scheduled/admin. Evaluates advertisers approaching a term boundary and drives the ladder: • auto-advance opted-in + measured ROI threshold met → post an ADVANCE NOTICE (pre-charge), and once the
- **`advertiserRenewAgree`** — advertiserRenewAgree — the one-tap "Agree" that renews the SAME tier for another year after the advertiser has seen their results. Records the renewal consent (auto-renewal law: they saw a notice + agreed), banks a year toward the caps, and restarts the term. Does NOT move money — billing runs on…
- **`advertiserReportRevenue`** — advertiserReportRevenue (auth) — an advertiser reports their own OFF-PLATFORM revenue for a period so it can be counted (clearly flagged as advertiser-reported, not platform-measured) in their performance metrics (ROAS/ROI). This is the write path for AdvertiserReportedRevenue, which advertiser-m…
- **`advertiserSetAutoAdvance`** — advertiserSetAutoAdvance — the explicit opt-in an advertiser makes at signup (or anytime): "if my MEASURED ROAS reaches X, advance me to the next tier." Records the consent + disclosure (this is the affirmative authorization that keeps auto-advance out of negative-option territory) and stores the…
- **`advertiserSocialValue`** — advertiserSocialValue — report the delivered ad VALUE an advertiser has earned from user-amplified social posts: total reach, estimated impressions, and $ value (at the same CPM the value guarantee uses). Feeds the advertiser's ad-value total and their measured ROI report. Measured, never guarant…
- **`advertiserWeeklyReport`** — advertiserWeeklyReport (scheduled service-role, or manual per-advertiser) — the automatic weekly AI performance report for EVERY advertiser across ALL tiers/offers. It measures the conventional PPC metric set (impressions, clicks, CTR, CPC, conversions, CPA, revenue, ROAS/ROI) + social/engagement…
- **`aiAdCampaignOptimizer`** — Fetch all active ad listings for this user
- **`appInterstitialGate`** — appInterstitialGate (authenticated) — the full-screen IN-APP ad shown at natural breaks during general app use (NOT just between surveys). Served from your OWN inventory (AdGrid / sponsored / house), so the impression is your ad revenue. Shown to EVERYONE by default (IN_APP_AD_NONPREMIUM_ONLY can…
- **`autoAdCampaignCreation`** — Auto-creates and optimizes ad campaigns for developers who don't have one
- **`autoAdCampaignLifecycle`** — New AdCampaign created → AI-generate suggestions + notify advertiser
- **`autoAdCampaignSelfOptimizer`** — Scheduled daily: invoke AI optimization loop for all active AdCampaigns with ai_bid_enabled
- **`autoSponsoredContentDeadlineChecker`** — Daily: send deadline reminders for sponsored content approaching due date
- **`autoSponsoredContentLifecycle`** — Notify creator of new sponsorship deal
- **`buySponsoredPlacement`** — buySponsoredPlacement (A3 / B13) — a business pays to FEATURE/boost a listing (or run an ad slot) for a period. Customer prices are unchanged; the business pays for visibility. Creates a SponsoredPlacement the store reads to boost sort order, and books the revenue.
- **`runAdCreativeABTest`** — ACTION: create — generate AI variants and start test
- **`submitAdvertiserApplication`** — submitAdvertiserApplication (public write) — captures an advertiser application / interest lead from the /Apply page. Marketing/CRM only: it records interest so you can follow up. It NEVER originates credit or charges anything. Works logged-in or not (captures the user id if present).

### Store, Marketplace & Fulfillment (51)

- **`addCatalogToStorefront`** — addCatalogToStorefront — a user curates a PLATFORM-CATALOG product they found via search into their own storefront. It becomes a listing under their username on the seller marketplace, but the platform sources and fulfills it (AI order function) and keeps the wholesale spread; the buyer pays no m…
- **`addWishlistProducts`** — addWishlistProducts (authenticated) — from the profile/KYC step: the user names products they want; each is added to their wishlist (source "profile" → shows under "You added"). De-duped by name. Up to 20. Body: { products: [{ name, image_url?, product_url? }] } → { added }
- **`adminSettingsCatalog`** — adminSettingsCatalog (ADMIN) — returns every adjustable setting with its current EFFECTIVE value and where that value came from (db override / env / default), grouped for the admin panel.
- **`affirmCheckoutConfig`** — affirmCheckoutConfig (authenticated buyer) — build the Affirm checkout object for a REAL, shippable marketplace item so the client can open Affirm.js. Affirm underwrites the buyer and carries the default risk; the merchant is paid upfront. This is for REAL GOODS ONLY — never for points, store
- **`aiCatalogSeed`** — aiCatalogSeed (INTERNAL/ADMIN, scheduled) — populates the marketplace catalog, per country, with Amazon-breadth categories, using the TEMPLATE-ONCE + CLONE-PER-COUNTRY model: 1. Build a country-agnostic TEMPLATE set of ORIGINAL products spread across every category. Product
- **`aiMarketplaceQualityVetting`** — Fetch pending content submissions (ads, templates, games)
- **`aiOrderAssistant`** — aiOrderAssistant (authenticated) — the shopping copilot. The user says what they want; the AI searches authorized product feeds + the platform catalog, autofills real order options, and drafts a SourcedOrder the user reviews and approves. The AI does 100% of the discovery/autofill; the human only…
- **`aiOrderFulfillment`** — ─── Carrier tracking helpers ─────────────────────────────────────────────────
- **`aiOrderVetting`** — Allow both scheduled (no auth) and manual admin invocation
- **`aiProductAnalyticsReport`** — Get survey details
- **`aiProductReview`** — Called from entity automation: payload has event + data
- **`appStoreCategories`** — appStoreCategories (authenticated) — the App Store's sections + subsections, each with its serverless-GPU category tile (when generated). This is what the App Store UI renders to show all the mobile-app categories with images and their subsections, and to drive the category filter.
- **`appStoreSearch`** — appStoreSearch (authenticated) — search ANY app or game by free-text query, optionally narrowed by category and/or subsection. Searches the Games catalog plus app-type marketplace listings, and returns a merged, relevance-ish result set. This powers the App Store search bar.
- **`assistedCheckout`** — assistedCheckout (authenticated) — the user APPROVES a drafted item and we execute it through the right SANCTIONED channel. The buyer always completes/authorizes their own purchase; no bot, no stranger, no money moved to a workforce.
- **`autoAppStorePriceAlert`** — Find all users who have this app in their wishlist
- **`autoFeedbackAndProductEngine`** — Automates: daily feedback surveys, mockup vote generation, user suggestions, feature pipeline, A/B tests
- **`autoOrderFulfillmentAndFundsRelease`** — Process pending AI fulfillment orders
- **`autoOrderLifecycle`** — Welcome confirmation email
- **`autoOrderLifecycleEngine`** — Automates: order fulfillment, status updates, tracking, fund release, vetting, delivery confirmation
- **`autoWishlistCartSuggestion`** — If user has enough balance, suggest purchase
- **`cancelStoreOrder`** — cancelStoreOrder (authenticated) — the buyer cancels an order that HASN'T shipped yet and is refunded, in the closed loop (store credit / points restored — never cash). Supports the FTC Mail/Internet Order Rule ("30-Day Rule"): if we can't ship in time, the buyer can cancel for a full refund. Ide…
- **`catalogAssistantChat`** — catalogAssistantChat (authenticated) — the AI shopping assistant that greets a member the FIRST time they open the marketplace catalog. It opens by asking what they're interested in, but it is already grounded in their KYC survey answers, so the question is warm and specific rather than cold. Powers
- **`checkoutOwnershipQuote`** — checkoutOwnershipQuote (authenticated) — the percentage-first checkout. The user says how much they want to pay OUT OF POCKET for an item; we return the split as PERCENTAGES + survey minutes: how much they pay now vs how much they earn back as an ownership-% discount, and the minutes of surveys t…
- **`checkoutSiteCashQuote`** — checkoutSiteCashQuote (auth, read-only) — how much Site Cash would auto-apply to a purchase of `price_usd`, and the resulting card/real-money remainder. Any checkout UI (especially client-captured card flows like the store) calls this BEFORE creating the card charge, so it can charge the reduced …
- **`cosmeticsCatalog`** — cosmeticsCatalog (authenticated) — the closed-loop virtual-goods store. Returns the catalog (admin-curated CosmeticItem rows override/extend the starter DEFAULT_COSMETICS), which items the caller already owns, which is equipped per type, and the caller's spendable Site-Cash (current_balance = non…
- **`createMarketplaceListing`** — createMarketplaceListing (authenticated seller) — Facebook-Marketplace-style listing. Seller sets a points price and/or a USD price; buyers pay with points or by card (card adds the platform markup). The seller is responsible for shipping. Body:
- **`dropshipFulfill`** — dropshipFulfill (INTERNAL/ADMIN) — places the real supplier order for a PAID dropship order via the connected supplier's API (full automation). If the supplier isn't connected, it drops to the buying desk so the order is never lost. Idempotent: won't re-place an already-fulfilled order.
- **`giftStoreItem`** — giftStoreItem — buy a catalog product/service and have it delivered to ANOTHER user. This preserves the social "send something to a friend" feature WITHOUT transferring spendable value between users (the money-transmission trigger that p2p_transfers guards). The GIVER pays from their
- **`householdDecideOrder`** — householdDecideOrder (holder only) — approve or reject a teen's pending order. approve → the order moves to awaiting_payment so it can be completed (nothing is charged here; card capture is external and points are captured when the teen completes checkout).
- **`hybridCheckout`** — hybridCheckout (authenticated) — pay by CREDIT CARD and (optionally) APPLY POINTS. The user's points cover as much as the per-transaction spend cap allows (12% non-premium / 24% premium of their balance); the AI order fulfillment — funded by the owner's PayPal business account — fronts the CASH v…
- **`layawayContribute`** — layawayContribute (authenticated) — apply earned points toward an open layaway. When fully paid, the item is released to fulfillment (ship or local pickup) and any welcome credit is redeemed. Body: { layaway_id, points }
- **`layawayStart`** — layawayStart (authenticated) — reserve a physical item and open a layaway plan the buyer pays down with earned points BEFORE it ships (no credit extended). Required monthly is capped at LAYAWAY_MAX_MONTHLY_USD (default $90). Body: { listing_id }
- **`layawayStatus`** — layawayStatus (authenticated) — list the user's layaways (or cancel one, refunding paid points). Body: { cancel_id? }
- **`liveShoppingOrder`** — liveShoppingOrder — places an order from a live-shopping / QVC-style hosted session and feeds it into the EXISTING order → fulfillment → funds-release pipeline (nothing new for moving money). The buyer pays in SITE CASH (points); the platform's 50% is recorded to the revenue ledger; the order is …
- **`marketplaceSearchLink`** — marketplaceSearchLink (authenticated) — "now go find the real thing." Returns sorted search links across multiple engines (Amazon, Google Shopping, eBay) so a click pulls up real listings from across the internet. Amazon carries the affiliate tag when authorized (disclosed). Supports sort
- **`orderDelayNotice`** — orderDelayNotice — scheduled/admin. FTC Mail, Internet, or Telephone Order Merchandise Rule ("30-Day Rule"): if an order can't ship within the time promised (or 30 days when none was given), the buyer must be NOTIFIED and offered the option to cancel for a full refund. This sweep finds undelivere…
- **`paypalCaptureCheckout`** — paypalCaptureCheckout (authenticated) — capture an approved PayPal payment, mark the order paid, record the money-in flow, and kick AI fulfillment. Idempotent: a re-capture on an already-paid order is a no-op. Body: { order_id } (or { paypal_order_id })
- **`paypalCreateCheckout`** — paypalCreateCheckout (authenticated) — start a live PayPal payment for an existing order's card amount. Returns the approve_url the client redirects the buyer to. Requires PayPal env keys; returns configured: false otherwise so the UI can fall back gracefully.
- **`physicalStoreConfig`** — physicalStoreConfig (authenticated) — everything the Physical Items store needs to render: which payment options are available, the card markup, the affordability threshold, the user's remaining promotional (welcome) credit, and the local-pickup note.
- **`placeStoreOrder`** — Server-authoritative store order (product OR online service → pay → AI fulfillment). Payment methods: • survey_balance — spends the user's in-store credit (current_balance). Regular users pay the
- **`productBestPrice`** — productBestPrice (authenticated) — the shopper picked an exact product; find the CHEAPEST all-in version and apply the member benefit. It scores every offer we can actually price by LANDED COST (item + tax + shipping − existing
- **`productSearch`** — productSearch (authenticated) — direct search of the connected product feeds (discovery), each result tagged with the sanctioned channel it will check out through. Returns [] (feeds_connected:false) when no feed is wired, so the UI can prompt to connect one.
- **`productStats`** — productStats (read-only) — the compiled statistics for a product (or the published set). Returns real "results" once a product has enough orders, otherwise a "gathering data / how it works" view. Safe to show to buyers and to feed the AI concierge. Auth required (any signed-in user); only publish…
- **`productStatsCompile`** — productStatsCompile (INTERNAL/ADMIN, meant to be SCHEDULED) — aggregates real Orders per product and stores one ProductStat row per product (units, buyers, median/avg revenue, AOV), marking it published once the sample passes the threshold. This is the "collect statistical data on anything sold" …
- **`purchaseMarketplaceListing`** — purchaseMarketplaceListing (authenticated buyer) — buy a marketplace item with POINTS (on-site, closed-loop) or by CARD (adds the platform markup). Behavior branches on listing.source: • user — a member's own item. Seller is credited; seller ships (existing flow).
- **`purchaseStoreCredit`** — Buy store credit with a card (regular users). This is 1:1 — NO markup at top-up. The single 10% platform fee is charged ONCE later, when the user buys an item (see placeStoreOrder). The card payment is captured client-side (PayPal Orders / Stripe);
- **`serviceStoreCategories`** — serviceStoreCategories (authenticated) — the Services section's sections + subsections, each with its serverless-GPU category tile (when generated). Mirrors appStoreCategories so the Services store gets the SAME category-tile browse experience as the App Store and the retail catalog. The UI renders
- **`submitProductForReview`** — Create PendingProduct record
- **`trackProductWebsiteVisit`** — Get query params for tracking
- **`uxSessionRecorder`** — Records a scrubbed UX session (interaction heatmap/telemetry) for analysis.
- **`validateStoreAccess`** — Get user's daily earnings for today

### Payments, Payouts & Economy (63)

- **`advanceGrant`** — advanceGrant — the GATED grant. For an eligible member, fronts store credit (Site Cash / points) up to the amount they qualify for, records an Advance row (status "outstanding"), and stamps the member's outstanding balance. FREE — no fee, no interest is added. Idempotent per member while an advan…
- **`advanceOffer`** — advanceOffer — read-only: tells the signed-in member whether they qualify for a purchasing-power advance and, if so, how much (graduated by their recoupment track record), with the honest disclosure. Moves nothing. Reports enabled=false while the advance is gated off (pending counsel).
- **`advanceRecoupSweep`** — advanceRecoupSweep — the GATED recoupment. For each outstanding Advance, applies a share (ADVANCE_RECOUP_PCT) of the member's rewards earned since the last sweep to the outstanding balance — the member still keeps the rest, so recoupment never zeroes their earning. When a member's term ends and f…
- **`advanceStatus`** — advanceStatus — read-only: the signed-in member's current advance (amount, outstanding, recouped, forgiven) and their recoupment track record. Moves nothing.
- **`aiAdvancedSupportResolver`** — Fetch pending support tickets
- **`aiPayoutAdvanceEngine`** — RETIRED. This engine used to (a) offer regular users an "instant cash advance" against future earnings — the same credit family as the retired Goods Advance — and (b) make platform-authored earning-velocity *predictions*, which the earnings_projections posture (OFF, FTC earnings-claims
- **`aiPayoutFraudDetection`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`aiPayoutInsight`** — Fetch user data
- **`aiPayoutOptimizer`** — Build context for AI
- **`aiPayoutScheduler`** — Fetch earning history
- **`aiPayoutSchedulerEngine`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoAdvancedModeration`** — Get flagged content requiring moderation
- **`autoAutomatedPaymentProcessor`** — Daily: process AutomatedPayment records that are due
- **`autoCreatorEconomyEngine`** — Automates: creator payouts, subscription renewals, tip processing, content monetization, IAP validation
- **`autoCreatorPayoutLifecycle`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoCreatorPayoutOptimization`** — Get creators with pending payouts
- **`autoMoneyTransferAIVetting`** — Get sender history
- **`autoMoneyTransferLifecycle`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoPayPalReconciliation`** — Calculate totals from internal records
- **`autoPayoutCompletionNotifier`** — New payout queued
- **`autoPayoutRecommendations`** — Skip if recent recommendation exists (within 7 days)
- **`autoPayoutRequestLifecycle`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoPayoutStatusReconciliation`** — Scheduled: reconcile processing payouts against PayPal/Stripe and update statuses
- **`autoReferralPayoutEngine`** — DEPRECATED under the AFFILIATE model. The milestone-based referral commission engine is replaced by a single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer pays anything.
- **`autoSmartReferralPayouts`** — Fetch pending referral payouts
- **`autoTransferAndGiftEngine`** — Automates: money transfers, gift transactions, transfer requests, promo code expiry, notification cleanup
- **`billingScheduleStatus`** — billingScheduleStatus (auth, read-only) — the caller's advertiser billing picture: the full 52 weeks they PREPAID up front, and how it's tracked across 13 four-week cycles (which cycle they're in, how much of the prepay has been recognized). Works for Tier 1 / Tier 2 / Tier 3 Unlimited. Records/m…
- **`calculateDeveloperPayout`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`calculatePayoutWithFraudVetting`** — Closed-loop wall: cash payout records are only for verified business PARTNERS (affiliate/developer revenue shares). A regular user's earnings stay as on-site store credit — no cash Payout is created.
- **`cashappPayout`** — CashApp Cash Card is a Visa debit card. Stripe Instant Payouts push money to any Visa/Mastercard debit card within 30 minutes. Frontend collects Cash Card details via Stripe Elements, sends us a card token.
- **`confirmStripePayment`** — Retrieve the payment intent to check status
- **`createSharedWalletGroup`** — Creates a shared wallet group (e.g. a family pool). The creator becomes the owner and first member. Returns an invite code others use to join.
- **`createStripePaymentIntent`** — Create Stripe PaymentIntent using fetch (no external SDK needed)
- **`flexPayAccept`** — flexPayAccept — opt-in origination of a flexible-payment (installment) plan. HARD-GATED: refuses unless the program is live (flag + licensed provider + counsel sign-off), ability-to-repay is confirmed, and the disclosures are accepted. Payment is by CREDIT CARD (4 scheduled charges/year) — never …
- **`flexPayOffer`** — flexPayOffer (read-only) — the LAST-RESORT flexible-payment offer for a product. Returns the installment plan + disclosures ONLY when the program is live (flag + licensed provider + counsel sign-off), the customer has declined the other options (last_resort), and ability-to-repay is confirmed. Ot…
- **`fraudPayoutMonitor`** — Check for suspicious payout patterns
- **`giftSiteCash`** — giftSiteCash (authenticated) — the sender gifts closed-loop Site Cash (current_balance) to another user by email or id: the sender is debited the gross, the recipient is credited the NET, the platform keeps the spread (booked as `breakage`). NOTE: because the value moves BETWEEN user balances, th…
- **`goodsAdvanceAccept`** — goodsAdvanceAccept — opt-in origination. HARD-GATED: refuses unless the program is live (flag ON + a licensed provider configured + counsel sign-off). Records disclosure consent and an approved advance; actual disbursement is performed by the configured licensed provider integration.
- **`goodsAdvanceEligibility`** — goodsAdvanceEligibility — read-only: is the Goods Advance available to this member, and for how much? Safe to call anytime; returns available:false with a reason when the program is off or the member doesn't yet qualify (ability-to-repay). Never originates anything.
- **`goodsAdvanceTracker`** — goodsAdvanceTracker — informational repayment projection for the member's active advance. Encouragement only; never penalizes. Non-recourse: nothing is owed in cash.
- **`joinSharedWalletGroup`** — Joins a shared wallet group by invite code.
- **`negotiateDisputeSettlement`** — Fetch dispute and chat history
- **`paypalPayout`** — --- Closed-loop policy: no cash out to regular users; business partners only ---
- **`premiumFinanceDaily`** — premiumFinanceDaily (INTERNAL/ADMIN, scheduled daily) — for each active financed-Premium plan: 1) if the member earned today and hasn't been processed today, deduct $1 of Site Cash toward the membership (never below 0) and add the day's earnings to the cycle's monthly total;
- **`processAffiliatePayouts`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`processAutomatedPayouts`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`processMonthlyAffiliatePayouts`** — Respect the global cash kill-switch: even an admin batch can't disburse cash while cash_out is OFF. (This rail pays partner affiliates; it must still honor the same emergency brake as every other rail.)
- **`processRewardPayout`** — Age from a DOB field, if present (null when unknown → don't block on unknown age).
- **`processScheduledPayouts`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`recurringBillingOptOut`** — recurringBillingOptOut (authenticated) — the unified "click to cancel" path for recurring charges (the control auto-renewal law requires). Turns OFF auto-renew across the caller's recurring surfaces so no future rebill can occur: their PPC Grid subscription flag, any active generic Subscription, …
- **`requestManualPayout`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`requestPayout`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`respondentMicroPayout`** — Validate response passes fraud + quality thresholds
- **`scheduleAndProcessPayouts`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`setSiteCashAutoApply`** — setSiteCashAutoApply (auth) — the buyer's OWN preference: automatically apply my Site Cash to purchases at checkout, or not. This overrides the site-wide default for this user. Send { auto_apply: true|false } to set, or { reset: true } to clear the preference and fall back to the site default. GE…
- **`siteCashPerksStatus`** — siteCashPerksStatus (authenticated) — powers the closed-loop "Site-Cash extras" page: current balance, the gifting config (fee/min/max + a sample split), and the earn-boost config + whether one is active now. Read-only.
- **`smartPayoutScheduler`** — Fetch all users with pending approved balances
- **`stripeWebhook`** — stripeWebhook — PUBLIC endpoint (no user auth; Stripe authenticates via signature). Completes the SCA / 3-D Secure flow: an advertiser subscription is created 'default_incomplete' and the seat is left PENDING until payment actually clears. Stripe calls this when that happens, and we flip pending …
- **`superAgentFinancePayouts`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`transferCredit`** — Server-authoritative user-to-user STORE-CREDIT transfer (closed-loop platform credit, not cash). Both sides move on the server: debit sender, credit receiver, record the transfer. The client can no longer write balances directly, so this is the only path for a transfer.
- **`treasuryReserveReport`** — treasuryReserveReport (ADMIN) — the up-to-date solvency picture for the business account: cash available, the reserve that MUST stay to cover every obligation (outstanding Site Cash, pending payouts, tax set-aside, buffer), and how much is safe to withdraw. Also reports the platform-funded portio…
- **`treasuryWithdrawCheck`** — treasuryWithdrawCheck (ADMIN) — "can I withdraw $X from the business account right now without leaving expenses uncovered?" Returns allowed/blocked, the most you can safely take, and why. Read-only; it does not move money (PayPal withdrawals happen in PayPal). Use it before pulling funds so you n…
- **`venmoPayout`** — Venmo is owned by PayPal. PayPal Payouts API sends directly to Venmo-linked email or phone. This is fully automated — money arrives in the recipient's Venmo balance instantly.

### Loyalty, Rewards, Boost & Gifting (39)

- **`aiRewardsEngine`** — Fetch user context data
- **`autoDailyStreakEngine`** — Daily: update streaks, send reminders for at-risk streaks, pay the daily streak reward
- **`autoGiftTransactionLifecycle`** — Notify recipient
- **`autoPointsBoostCredit`** — autoPointsBoostCredit (INTERNAL/ADMIN, scheduled daily) — the "daily harvest" job. It auto-credits each active user's accrued Boost growth so their points visibly grow even without a manual harvest. Bounded per-user by the engine's daily + lifetime caps (breakage-funded, ~$0). Only touches users
- **`autoRewardRedemptionEngine`** — Automates: reward perk expiry, redemption record processing, tiered membership upgrades, virtual currency distribution, cosmetic item availability, inventory management v2: all sub-calls use .catch() to prevent 403 propagation from headless invocations
- **`autoStreakAndGamificationEngine`** — Automates: daily streaks, XP awards, level-ups, badges, leaderboard updates, challenges, seasonal ranks
- **`awardReferralJackpotEntries`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`awardReward`** — Server-authoritative reward CREDIT. Balance fields are now server-only (the client can no longer write them via /auth/updateMe), so every credit flows through here. This function is:
- **`awardSocialMediaJackpotEntries`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`claimDailyBoost`** — claimDailyBoost (authenticated) — grants 5 MINUTES of free app use (no in-app-purchase charges) ONCE per day, only if the user has earned the threshold ($4) in offers today. It opens a time-boxed window (free_app_time_until) plus a credit cap the game store honors at checkout while the window is …
- **`claimGroupGoalReward`** — claimGroupGoalReward — once a group has collectively REACHED its goal, each member claims the PLATFORM-FUNDED reward for THEIR OWN account: non-cashable, closed-loop store-credit points, capped. This is the ONLY money-touching step, and value flows platform → member only (never member → member).
- **`creditPendingReferralPostRewards`** — Credits a user's pending $0.10 referral-post rewards. Called when a user completes a survey (the reward is "held until the next survey"). Accepts an explicit { user_id } (for server-side calls) or uses the authenticated user.
- **`dailyBoostStatus`** — dailyBoostStatus (authenticated) — "earn $4 in offers today → 5 minutes of free app use, no in-app purchase charges." Returns today's earnings vs the threshold, whether the boost is unlocked/claimed, the free-minutes, and any active free-app-time window. Net-neutral: funded by the offer revenue.
- **`endorserRewardSweep`** — endorserRewardSweep — the GATED payout for the paid-endorser program. For each pending EndorserConversion, it pays the member a share of the MEASURED conversion value in Site Cash — but ONLY if the post was #ad-disclosed and it wasn't a self-conversion, and always within the member's daily + peri…
- **`giftBoostSend`** — giftBoostSend (auth) — send a PLATFORM-funded, capped, non-cashable boost to another user. The platform grants the recipient the bonus; the sender optionally spends their OWN points as the trigger. No value moves from sender to recipient, so there is no money transmission.
- **`giftBoostStatus`** — giftBoostStatus (read) — config, how many boosts the caller can still send today, and recent boosts they sent or received. Read-only.
- **`giftCardOptions`** — giftCardOptions (authenticated) — what gift cards are available to redeem points for (retailer, face values, and the points each costs), plus the user's current balance.
- **`giftCardStockAdd`** — giftCardStockAdd (INTERNAL/ADMIN) — add gift-card inventory (bought in bulk, often at a discount = margin). Accepts one card or a batch. Body: { retailer, face_value_usd, code, pin?, cost_usd? } OR { cards: [ {retailer, face_value_usd, code, ...} ] }
- **`loyaltyDailyReconcile`** — loyaltyDailyReconcile (INTERNAL/ADMIN, scheduled daily) — tracks each enrolled member's active-day tally toward the 5-day/week term (for members who completed the day's PPC-survey requirement) and flags renewal when the one-year term is complete. The 10% discount is PLATFORM-ABSORBED (funded by
- **`loyaltyEnroll`** — loyaltyEnroll — join the retail loyalty & rewards program. Requires: the two consents (social posting with #ad disclosure, and the one-year term agreement), and an open 1:1 slot (rewarded members ≤ signed-up advertiser businesses). Points stay EARNED,
- **`loyaltyQuoteDiscount`** — loyaltyQuoteDiscount — how much member discount applies to a given subtotal RIGHT NOW. Used by the cart UI. Returns only the discount for THIS cart (never the back-end pool balance or annual cap). Body: { subtotal_usd }
- **`loyaltySavings`** — loyaltySavings (authenticated) — a FACTUAL "here's what you've saved" tracker: value already earned from surveys + points-back, net of any markup paid, plus a real-dollar figure and a "% saved" number. It hands out nothing; it's a mirror of realized activity. Gated behind the purchase_payback admin
- **`loyaltyStatus`** — loyaltyStatus — what the MEMBER sees. Deliberately hides the back-end value figures (the $1,460 annual cap and cumulative usage are never returned); it only tells the member whether their points-back is active right now and what today's steps are. Membership is indefinite. Body: {}
- **`loyaltyUpfrontEnroll`** — loyaltyUpfrontEnroll (authenticated, PREMIUM members only) — opt to take your reward value UP FRONT. You're enrolled as an affiliate; the grant is escrowed and RELEASED incrementally to spendable store credit as you generate real affiliate commission worth 2× the grant. Vesting, not a loan: no cl…
- **`pointsApplyPreview`** — pointsApplyPreview (authenticated) — powers the "Apply my points" button at checkout: how many points the user COULD apply to this item and what it saves, WITHOUT committing anything. Read-only. Body: { listing_id } or { price_usd }
- **`pointsBoostHarvest`** — pointsBoostHarvest (authenticated) — the user "harvests" their accrued growth into spendable, closed-loop, non-cashable points. Bounded by the daily + lifetime caps in the engine. Records a live-experiment metric so the self-tuning layer can measure whether the Boost drives engagement.
- **`pointsBoostStatus`** — pointsBoostStatus (authenticated) — returns the live Boost ticker data: the user's personal Boost %, their balance, per-day growth, accrued-but-unharvested points, vault state, and lifetime cap. The client animates between polls to make it feel like a live, appreciating number.
- **`pointsBoostVault`** — pointsBoostVault (authenticated) — lock/unlock points into the Vault for a higher Boost. Locking is a reversible flag (no real lock-up), and vaulted points stay closed-loop (never cashable). Encourages holding, which is breakage-friendly and cheaper for the platform.
- **`premiumBoostApply`** — premiumBoostApply (auth) — the member applies a chosen amount of their boost credit to a specific item. They pick how much of the boost to use and which item. Debits the non-cashable boost credit and hands the applied amount to the normal order/fulfillment flow. Bounded by the item price and thei…
- **`premiumBoostClaim`** — premiumBoostClaim (auth) — a premium member claims (part of) their advertiser-funded boost. They choose how much, up to their remaining cap and what the pool has. The claimed amount is granted as non-cashable boost credit on the member (gift_boost_credit_usd) and consumed from advertiser funding.…
- **`premiumBoostFund`** — premiumBoostFund (INTERNAL/ADMIN) — record an advertiser's contribution to the member-boost pool. Call this when a PPC / Tier 1 advertiser payment is recorded: it adds one funded contribution (default PREMIUM_BOOST_PER_ADVERTISER_USD, i.e. $2,000 — 1:1 advertiser→member) that premium members can …
- **`premiumBoostStatus`** — premiumBoostStatus (read) — the caller's advertiser-funded boost: eligibility (premium), how much they've claimed/used, their unspent boost credit, how much more they can claim, and the pool availability.
- **`prestigeStreakEngine`** — Service role for reading user activity
- **`processWeeklyJackpot`** — Weekly OPEN, MERIT-BASED referral reward (formerly a random jackpot). Every participant earns in proportion to the VERIFIED, revenue-generating referrals they drove — no chance, and no one is excluded. The reward pool is
- **`redeemPointsForGiftCard`** — redeemPointsForGiftCard (authenticated) — the gift-card rail: the user spends NON-CASHABLE points for a real retailer gift card they then use themselves. Store credit for a specific retailer — not cash to the user — so the closed-loop shield holds. Respects the per-transaction spend cap + inventory.
- **`redeemRewardPerk`** — Headless batch invocation — just validate pending redemptions
- **`referralWelcomeEmail`** — Triggered by entity automation on Referral create
- **`sessionRewardValidate`** — sessionRewardValidate — the TRUST BOUNDARY for Tier-3 player hosting. A peer-hosted session is untrusted, so this NEVER accepts the reward a session claims. It: 1. loads the authoritative GameSession we started (so a host can't fabricate a session that never ran),
- **`welcomeCreditStatus`** — welcomeCreditStatus (authenticated) — the buyer's welcome-rewards balance + the advertised value figure, for banners and onboarding. Lazily grants the pool on first call.

### Referrals, Affiliate & Growth (62)

- **`affiliatePerformanceMonitoring`** — Fetch all affiliates with recent performance data
- **`affiliateReferralFraudDetector`** — Fetch referrals for this affiliate (or all if no ID given)
- **`aiAffiliateOptimizationEngine`** — Fetch affiliate's own data
- **`aiGrowthContentEngine`** — No body — scheduled/headless invocation, will batch below
- **`aiReferralEmailNotifier`** — Get all inactive referred users (invited but not converted in last 7 days)
- **`aiViralContentPublisher`** — This can be called by admin or automation
- **`analyzeAffiliateDispute`** — Fetch historical disputes for pattern matching
- **`analyzeAndAssignAffiliateTier`** — Get affiliate tiers
- **`autoAffiliateAndStreamerEngine`** — Automates: affiliate sale commission processing, streamer tip payouts, game voting tally, survey schedule execution, PPCSession closure/rewards, growth heatmap data collection, affiliate product management, survey recommendation matching
- **`autoAffiliateSaleLifecycle`** — Notify affiliate of new sale
- **`autoAffiliateWinBackCampaign`** — Find inactive affiliates (no activity in 14+ days)
- **`autoContentSuggestionsForAffiliates`** — Get competitor trends and top templates
- **`autoGrowthAndOnboardingEngine`** — Automates: user onboarding, growth heatmap, LTV optimization, churn prevention, referral growth
- **`autoMLMWebsiteCreditNotifier`** — Notify on meaningful credit increase (>= $1)
- **`autoReferralCampaignManager`** — Auto-creates and manages referral campaigns for every user
- **`autoReferralCampaignSequencer`** — Daily: manage ReferralCampaign performance and trigger follow-up sequences
- **`autoReferralCommissions`** — DEPRECATED under the AFFILIATE model. Ongoing per-earning referral commissions are replaced by a single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer pays anything.
- **`autoReferralContestDaily`** — ---- 1. Lifecycle: conclude finished week, ensure a fresh campaign is open ----
- **`autoReferralContestEngine`** — Automates: referral contest lifecycle, leaderboard, winner selection, prize payout, jackpot processing
- **`autoReferralConversionHandler`** — Create ReferralAchievement for referrer
- **`autoReferralCreatedLifecycle`** — Welcome the referred user + notify referrer
- **`autoSocialAndAffiliateEngine`** — Automates: social media posting, affiliate enrollment, ad posting, mosaic sharing, YouTube embedding
- **`autoViralContentDetection`** — Fetch recent content/games
- **`automatedWeeklyAffiliateReport`** — Get referral data for the past 7 days
- **`autonomousAffiliateOrchestrator`** — ─── STEP 1: Get all active social affiliates ───────────────────────────
- **`churnPredictionAffiliates`** — Fetch onboarding records
- **`concludeWeeklyReferralCampaign`** — Closes any active weekly referral campaign whose window has elapsed, builds the business and user leaderboards, and concludes it. Users with no entry this week are automatically "doubled up" next week (handled at submit time by submitReferralPost).
- **`createReferralSquad`** — Generate unique squad code
- **`detectReferralAnomalies`** — Get recent referrals for anomaly analysis
- **`distributeMLMBonus`** — Largest credible per-event referral earning. Anything above this is treated as an injection attempt and rejected — a real earning event is at most a few dollars.
- **`endorserConversionRecord`** — endorserConversionRecord — the documented HOOK the conversion-attribution flow calls when a member's disclosed sponsored post produces a measured conversion. Records a PENDING EndorserConversion; the gated endorserRewardSweep computes + credits the Site Cash reward (a share of the conversion valu…
- **`endorserPersonalizePost`** — endorserPersonalizePost — the AI social-post ENGINE for the paid-endorser program (the compliant version, gated OFF). For one opted-in, connected member it (1) checks consent + a live social connection, (2) turns the advertiser's APPROVED creative into copy native to the member's platform via the…
- **`endorserPostConversionHook`** — endorserPostConversionHook — the WIRE between a measured social-post conversion and the endorser reward. Whatever flow measures that a member's disclosed post drove a real conversion (a postback, an advertiser- reported sale, an attribution job) calls this with the member + the measured conversio…
- **`enrollSocialAffiliate`** — 1. Find direct referral record for this user
- **`flagSuspiciousReferrals`** — Run as admin to scan for risk patterns
- **`generateAffiliateContentSchedule`** — Get affiliate's past referral data to understand top content types
- **`generateAndPostAffiliateAds`** — Admin-only or automation call (no user auth required for scheduled run) 1. Get all active affiliate nodes
- **`generateWeeklyReferralCampaign`** — Publishes the weekly mandatory referral posting campaign, rotating the required platform each week (Twitter/X -> Instagram -> Facebook -> TikTok -> LinkedIn). Run weekly (e.g. Monday) via the weekly_referral_campaign_agent.
- **`growthBudgetAutoPlan`** — growthBudgetAutoPlan (INTERNAL/ADMIN, scheduled daily) — the AI that "keeps track of expenses and plans for an increasing budget." It runs the deterministic growthBudgetReport, stores a dated GrowthPlan snapshot, RAISES AN ALERT if the redemption reserve is underfunded (so you never spend money y…
- **`growthBudgetReport`** — growthBudgetReport (INTERNAL/ADMIN) — the self-sustaining growth flywheel on REAL cash, with the redemption reserve baked in so it never recommends spending money you need to honor points. Deterministic: every number comes from the RevenueEvent + Expense ledgers, User points, and points orders.
- **`growthContentEngine`** — Fetch real platform data for context
- **`migrateMLMToAffiliate`** — migrateMLMToAffiliate (admin) — one-time copy of legacy MLMNode balances into the new AffiliateAccount ledger. Idempotent: skips users that already have an AffiliateAccount. The old MLMNode rows are left intact as a backup (not deleted).
- **`predictAffiliateChurn`** — Fetch affiliates to analyze
- **`processReferralCommissions`** — DEPRECATED under the AFFILIATE model. Multi-tier per-survey commissions are replaced by a single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer pays anything.
- **`processReferralDailyBonus`** — DEPRECATED under the AFFILIATE model. The recurring $0.25 daily referral bonus is replaced by a single one-time flat bounty per active referral (see distributeMLMBonus + sdk/affiliate.ts). This endpoint no longer pays anything.
- **`processWishlistReferralConversion`** — Find referral
- **`referralAiCopy`** — referralAiCopy (authenticated) — generate a ready-to-post referral message TAILORED to the platform the user picked (tone, length, hashtags, emoji). The user copies it and pastes it themselves — the platform never posts on their behalf. One call per platform tap = minimal clicks.
- **`referralBonusRecord`** — referralBonusRecord — the documented HOOK the signup / advertiser-payment flow calls to register a pending two-tier referral bonus (all Site Cash). A USER referral is recorded ready-to-pay; an ADVERTISER referral is recorded PENDING and only becomes payable after its payment clears + the clawback…
- **`referralBonusSweep`** — referralBonusSweep — the GATED payout. Scans pending ReferralBonus rows and credits Site Cash to the referrer for the ones that are now eligible: a USER referral once active; an ADVERTISER referral only after its payment cleared AND the clawback window elapsed AND it wasn't refunded/charged-back.…
- **`referralContestLeaderboard`** — Scheduled automation path — update all active contest leaderboards
- **`referralInviteConfig`** — referralInviteConfig (authenticated) — read-only config for the on-device contact-invite flow. Returns the user's referral link, the customizable template, and today's remaining allowance. The server NEVER sends messages and NEVER receives contacts — sending happens on the user's own device.
- **`referralInviteRecord`** — referralInviteRecord (authenticated) — the DEVICE reports that the user sent `count` referral invites from their OWN phone (native SMS). This does NOT send anything and MUST NOT include any contact data. It records the user's consent + a data-minimized count for the anti-spam daily cap and attrib…
- **`referralMilestoneEmail`** — Triggered by entity automation on DailyEarnings update Sends a 'Milestone' email when referred user crosses $5 total earned
- **`referralReengagementEmail`** — Scheduled: runs daily — sends re-engagement emails to stalled referrals (7+ days inactive, < $5 earned)
- **`sendGrowthCampaignSequence`** — Get active campaigns
- **`sendReferralShareEmail`** — Send personalized invitation email
- **`submitReferralPost`** — Records a user's referral post for the active weekly campaign. - Normal week: 1 post required on the campaign's rotation platform. - If the user MISSED the previous week's campaign, their assignment "doubles up":
- **`superAgentReferralContest`** — === DAILY OPERATIONS (always run) ===
- **`trackReferralClick`** — Called when a user clicks/copies a referral link. Also called by verifyReferralConversion to record conversions.
- **`triggerAffiliateOnboardingSequence`** — Fetch onboarding record
- **`verifyReferralConversion`** — action_type: 'survey_completed' | 'purchase' earned_amount: USD amount the referred user earned (for commission calc)
- **`viralContentGenerator`** — Generates AI-drafted viral social posts and stores them as SocialMediaPost records with status "pending_review" for admin approval. Called from ViralContentDashboard with {}.

### Social, Buddy & Community (55)

- **`aiCommunityModerationEngine`** — Fetch recent forum posts and chat messages
- **`analyzeTopPerformingPosts`** — Get all social media posts from affiliates (last 30 days)
- **`autoChatMessageModeration`** — RULES FIRST (free): clearly-fine messages skip the AI entirely; clearly-bad ones are flagged without a model call. Only the ambiguous middle ('review') falls through to the AI below.
- **`autoChatModeration`** — Auto-moderates chat messages and forum posts — rules first (free), AI only for the ambiguous middle.
- **`autoCommunityEngine`** — Automates: forum post moderation, chat message AI replies/moderation, friend requests, game engagement XP, user activity analytics, leaderboard rank notifications, squad management
- **`autoEnrollUserInSocialPosting`** — Check if user already has social connections (skip if they do)
- **`autoForumPostLifecycle`** — AI moderate content
- **`autoForumPostModerator`** — RULES FIRST (free): approve clearly-fine posts and remove clearly-bad ones without a model call.
- **`autoFriendRequestLifecycle`** — Notify the recipient of the friend request
- **`autoLiveEventManagement`** — Automates: live event creation, activation, expiry, leaderboard updates, prize distribution
- **`autoNotificationDelivery`** — High-priority notifications → also send email
- **`autoPostContentToSocial`** — Get scheduled content ready to post
- **`autoSocialConnectionLifecycle`** — Notify the followed/connected user
- **`autoSocialPostingAndTracking`** — Refresh expiring tokens (within 7 days of expiry)
- **`automaticSocialPostingScheduler`** — The full PPC ad grid — mirrors GoogleAdsOverlay BUSINESS_ADS
- **`bitlabsPostback`** — HMAC-SHA256 of the callback URL (signature param stripped), hex, constant-time compared.
- **`buddyAcceptCommitment`** — buddyAcceptCommitment (authenticated) — record that this user AGREED to the buddy-chat commitment: to earn their daily take-home ($4.50, their half of $9) as part of using buddy chat. This is a consent/accountability record, applied to ALL tiers. It does NOT trap anyone — Leave and Report stay av…
- **`buddyBonusClaim`** — buddyBonusClaim (authenticated) — the "10% bump" for earning WITH a buddy: a closed-loop Site Cash bonus (a % of today's take, capped), granted once per day when the user has an active buddy and has earned today. Non-cashable, reserve-ledgered via recordSubsidy, and idempotent (one claim per day).
- **`buddyChatHub`** — buddyChatHub — tells the Buddy Chat client which actions to show in its "＋" menu, so the AI Social Shop and the four hosting options live inside Buddy Chat instead of separate screens. Pure gate-reading; the client renders the enabled actions. The whole hub is behind BUDDYCHAT_SOCIAL_SHOP_ENABLED…
- **`buddyConnectRequest`** — buddyConnectRequest (authenticated) — the $9-unlock reward: an OPT-IN, MUTUAL, IN-APP connection between buddies (add-as-friend within the app). Both must be unlocked (cumulative earnings ≥ threshold) AND both must request it before they're connected. This is in-app only — it deliberately does NO…
- **`buddyMatch`** — buddyMatch (authenticated) — pair the user with an available buddy for accountability while earning. If they already have an active buddy, returns it. Otherwise joins someone who's waiting, or creates a waiting slot. Pairing is opt-in and there's always a solo fallback — this never blocks anyone …
- **`buddyMessages`** — buddyMessages (authenticated) — recent encouragement messages for the user's buddy pair. Membership-checked (only the two buddies can read). Messages are auto-translated into the reader's chat language. Read-only. Body: { pair_id, limit? }
- **`buddyPickMatch`** — buddyPickMatch (authenticated) — pick a specific member (from buddyProfileBrowse) as your buddy. Picking is an INVITE, never a forced pairing: the target gets a notification and pairs only when they come to Buddy Chat. Body: { target_user_id, when?: "now" | "schedule", local_time?, timezone? }
- **`buddyProfileBrowse`** — buddyProfileBrowse (authenticated) — browse other members' KYC-derived interest profiles and pick your own match, instead of relying only on the auto-matcher. Returns privacy-safe cards (first name + interest fields only) for members who opted their profile public, ranked by how much they have in…
- **`buddyProfileVisibility`** — buddyProfileVisibility (authenticated) — opt IN or OUT of the browsable buddy directory. Browsing is opt-in: a user's KYC-derived interest card is only shown to others once they turn this ON. No card content changes here; this only flips whether the user appears in buddyProfileBrowse.
- **`buddyReport`** — buddyReport (authenticated) — safety: report and/or leave a buddy. Ends the pair immediately and records the report for moderation. Either buddy can do this at any time; no questions asked. Body: { pair_id, reason?, block? } → { success }
- **`buddyScheduleNext`** — buddyScheduleNext (authenticated) — book the NEXT Buddy Chat for tomorrow. Called when a session completes; EVERY tier (premium + non-premium) picks a LOCAL time and we store the absolute UTC instant + their IANA timezone, so the client can auto-open at exactly that moment and cross-timezone budd…
- **`buddyScheduledPopups`** — buddyScheduledPopups (INTERNAL/ADMIN, scheduled ~every 5 min) — the "auto pop-up" engine. For each booked next-session whose chosen moment has arrived (accounting for the lead time), it drops a "buddy_popup" notification that tells the client to auto-open Buddy Chat, then marks the booking "notif…
- **`buddySendMessage`** — buddySendMessage (authenticated) — send an ENCOURAGEMENT to your buddy. Canned cheers are always safe; free text passes the ANSWER-WALL (blocks anything that looks like sharing survey answers/content) and a daily rate limit. Nothing here lets buddies exchange answers.
- **`buddyStatus`** — buddyStatus (authenticated) — current buddy state: who you're paired with, both of today's progress, your unlock progress toward extended chat + connect, chat allowance left, and connect state. Read-only.
- **`captureSocialReach`** — captureSocialReach — capture / refresh a member's social follower reach ("take the social media counts of users who sign up"). Sums their active connections' follower counts, plus any explicitly-supplied per-platform counts from the signup form, and stores it as `social_reach` on the User. Call a…
- **`chatTranscriptExport`** — chatTranscriptExport (INTERNAL/ADMIN ONLY) — compile a buddy or group conversation into a plain-text transcript for SAFETY / MODERATION review. This is a moderator tool: users can NEVER pull each other's chats. Messages are retained for CHAT_TRANSCRIPT_RETENTION_DAYS (disclose in the privacy poli…
- **`cpxPostback`** — cpxPostback — MONEY-IN endpoint for CPX Research survey completions (the second survey network). Mirrors bitlabsPostback's reward path so every provider shares one payout rule: platform keeps the network cash, the user accrues non-cashable points (closed-loop), capped by the daily earn cap. Auth …
- **`deliveryGuaranteeStatus`** — deliveryGuaranteeStatus (auth, read-only) — the caller's advertising DELIVERY guarantee picture, per seat and across tiers: how many impressions were guaranteed for the term, how many have actually been delivered, whether delivery is on pace, and — at/after term end — any free make-good top-up ow…
- **`deliveryMakeGoodSweep`** — deliveryMakeGoodSweep (scheduled service-role) — the all-tiers DELIVERY make-good true-up. For every active advertising seat whose guarantee term has ended, it compares delivered impressions to the guaranteed volume and, on any shortfall, GRANTS a free make-good: it flags the seat to keep deliver…
- **`generatePostFromTrend`** — Generate a post inspired by the competitor trend
- **`liveExperimentCreate`** — liveExperimentCreate (INTERNAL/ADMIN) — open a live A/B holdout for a NON-SENSITIVE change. Money and compliance settings are refused here: they never auto-promote and must go through the human-gated recommendation path instead.
- **`liveExperimentPromote`** — liveExperimentPromote (INTERNAL/ADMIN) — manual override to promote or revert a running live experiment immediately (no downtime — a config flip). Use to force a decision or pull a change. Body: { id, action: "promote"|"revert", reason? }
- **`liveExperimentStatus`** — liveExperimentStatus (INTERNAL/ADMIN) — dashboard data: every experiment with its live measurement (per-arm rates, significance, probability the variant is better, guardrail health, traffic share, canary stage). Powers the real-time monitoring view.
- **`liveExperimentTick`** — liveExperimentTick (INTERNAL/ADMIN, scheduled every few minutes) — the real-time monitor. For every running experiment it: measures live results, trips the circuit breaker on any guardrail breach (instant revert to control), shifts traffic toward the better arm (Thompson-style) and advances the
- **`liveVariants`** — liveVariants (authenticated) — the request-time applier. Returns THIS user's effective variant overrides across all running live experiments (settings/flags/ui) and records a one-time exposure. The client fetches this once per session (quiet-swap) and applies the ui variants; server-side flows
- **`livestreamChannelBuild`** — livestreamChannelBuild — builds/refreshes the Omni-Channel Livestream shopping category. Takes the current top sellers, groups them into subcategory "channels" (mirroring the existing shopping sections), and for each featured product generates an AI image and — when OMNI_CHANNEL_COMMERCIALS is on…
- **`livestreamChannels`** — livestreamChannels — read endpoint for the Omni-Channel Livestream shopping section. Returns the category, its channels (subcategories that mirror the shopping sections), and the featured products with their AI image / commercial, so the client can render it alongside the other shopping sections.…
- **`mosaicAutoShareSocialMedia`** — Auto-post mosaic grid to social media twice daily
- **`postAdToSocialMedia`** — Get user's connected social accounts
- **`postGamerGainAds`** — Post 2 GamerGain ads across all 7 social channels twice daily
- **`reportChat`** — reportChat (authenticated) — the "Report inappropriate behavior" button. On click we IMMEDIATELY: end the reporter's chat, pull + snapshot the full transcript (and any attached files), flag every message for review, and open a SupportTicket in customer service. For a 1:1 the pair ends; for a grou…
- **`sessionSimulcast`** — sessionSimulcast — start/stop/status of pushing a hosted livestream to multiple RTMP destinations at once. It builds the fan-out PLAN (validated, secret-free) and dispatches it to the media RELAY (SIMULCAST_RELAY_URL), which does the actual WebRTC-in → RTMP-out fan-out and pulls each stream key f…
- **`setChatPrefs`** — setChatPrefs (authenticated) — the user's chat language (what they READ messages in) and the countries they'd like to be matched with. Chat is auto-translated into their language on display. Body: { lang, countries?: [ISO codes] } → { success, lang, countries }
- **`socialAmplifyConfirm`** — socialAmplifyConfirm — the "I posted it" confirmation for an amplified ad. Records a SocialAmplificationEvent carrying the member's reach → estimated impressions → $ value, attributed to the advertiser + tier, so it counts toward the advertiser's delivered ad value and measured ROI. Marks the pos…
- **`socialAmplifyDistribute`** — socialAmplifyDistribute — queue an advertiser's AI social ad to consenting members (all three tiers) for one-tap posting. Only opted-in members with connected accounts, #ad-disclosed. Creates queued SocialMediaPost rows tagged with the advertiser + tier; the member taps Post, then socialAmplifyCo…
- **`socialMediaOAuthHandler`** — Award jackpot entries
- **`socialShopTopTen`** — socialShopTopTen — the AI Social Shop's auto storefront: the current top-selling items over a rolling window, no manual curation. Reads recent orders and ranks them (units, then revenue). Returned as the default shop view in Buddy Chat, and used by the auto-feature job that promotes top sellers t…
- **`socialSignupConsent`** — socialSignupConsent — backs the one-click "Join" button. Records the member's decision on the social amplification disclosure (opt IN by default, or opt OUT) to the append-only consent ledger, sets the opt-in flags the distributor checks, and captures their social reach. The member must have SEEN…
- **`userAssistantChat`** — userAssistantChat (authenticated user) — back-and-forth AI assistant. Grounded in the user's compiled profile + the evolving site model, it answers questions and nudges the user toward engagement and purchases (respectfully). Body: { message, history?: [{role,content}] }

### Games, Contests & Gamification (61)

- **`aiBrowseNodeExpand`** — aiBrowseNodeExpand (INTERNAL/ADMIN, scheduled) — expands the taxonomy's THIRD level. For each subcategory it AI-generates a set of ORIGINAL browse nodes (finer product groupings), pushing the total node count past a large retailer's tens of thousands. Idempotent: subcategories that already
- **`aiExperimentEvaluate`** — aiExperimentEvaluate (INTERNAL/ADMIN, scheduled) — evaluate change-gating experiments that have collected enough customer feedback (or timed out) and apply the winners; archive the losers.
- **`aiGameCreatorFromFeedback`** — Aggregate all feedback data sources
- **`aiGameMonetizationEngine`** — AI Game Monetization Engine Automates: bid optimization, creative rotation, UA campaigns, fraud detection, ROAS optimization Similar to AppLovin MAX + AXON engine
- **`aiTournamentMatchmaker`** — Fetch tournament details
- **`aiUserExperienceOptimizer`** — Get UX session data
- **`analyzeGamePreferences`** — Fetch user's game engagement data
- **`autoAchievementBadgeAwarder`** — Create badge record
- **`autoContestEntryAndManagement`** — Auto-enters all eligible users into active contests and manages contest lifecycle
- **`autoContestManager`** — This runs as a scheduled function — service role only
- **`autoContestParticipationLifecycle`** — Confirm entry
- **`autoContestVerificationLifecycle`** — AI verify the submission
- **`autoFeaturedGameRotation`** — Check if rotation is needed (6 days since last featured)
- **`autoGameApprovalAI`** — Queue position for approved games
- **`autoGameApprovalLifecycle`** — New game submitted → notify admin + AI pre-screen
- **`autoGameEngagementLifecycle`** — Session ended (session_end set for first time)
- **`autoGameGuideLifecycle`** — AI moderate and score the guide
- **`autoGameMetricsAndApproval`** — If triggered by entity automation (new game created)
- **`autoGameRatingAggregation`** — Notify developer on milestone ratings
- **`autoGameRatingLifecycle`** — Recalculate game average rating
- **`autoGameReviewAggregator`** — Notify developer at milestones
- **`autoGameReviewAndRating`** — Auto-generates AI reviews for games that have no reviews yet
- **`autoGameReviewEngine`** — Automates: game reviews, ratings aggregation, sentiment analysis, bug report triage, content moderation
- **`autoGameReviewGeneration`** — Get games user played but hasn't reviewed
- **`autoLeaderboardAndPrestige`** — LeaderboardEntry created/updated → check for rank changes and notify
- **`autoLeaderboardRankChange`** — Only notify for significant rank changes or top positions
- **`autoStreamerSubscriptionExpiryChecker`** — Daily: remind subscribers 3 days before expiry; expire past-due subscriptions
- **`autoTournamentEngine`** — Automates: tournament creation, matchmaking, bracket management, prize distribution, leaderboards
- **`autoTournamentLifecycleEngine`** — Automates: tournament start/end lifecycle, bracket generation, prize distribution, head-to-head contest matching, referral contest lifecycle v2: sub-calls wrapped with .catch() to prevent auth errors from crashing the engine
- **`autoTournamentMatchLifecycle`** — Notify both players of scheduled match
- **`autoTournamentMatchTimeoutChecker`** — Hourly: escalate stalled tournament matches and send pre-match reminders
- **`autoTournamentParticipantLifecycle`** — Confirm registration to participant
- **`autoUserAchievementLifecycle`** — XP reward per achievement type
- **`autoUserActivityXPRollup`** — Get or create UserLevel record
- **`autoUserGroupFeaturedGameRotation`** — Weekly: rotate featured games across all UserGroups based on performance + dev contracts
- **`autoUserLevelUpNotifier`** — Level-up notification with bonus rewards
- **`autoXPAndAchievementEngine`** — Update UserLevel
- **`awardAchievements`** — Automation: runs on DailyEarnings create/update to check for achievements
- **`awardUserXP`** — Get or create user level record
- **`batchAwardAchievements`** — Streak calc
- **`batchGameRecommendations`** — Only process users active in last 30 days
- **`buyContestPowerUp`** — Purchases a head-to-head contest power-up, deducting virtual currency from the buyer and recording a ContestPowerUp. Called from HeadToHeadContest.
- **`contestOfficialRules`** — contestOfficialRules (public read) — the canonical Official Rules + short disclosure for the weekly prize competition, assembled live from settings + the jurisdiction engine. Link this from every contest/jackpot page and next to every entry control. No auth required; jurisdiction-aware if signed in.
- **`distributeTournamentPrizes`** — Compute a user's age from a date-of-birth field, if present. Returns null when unknown.
- **`enterSkillTournament`** — Pays the entry fee to join the current weekly SKILL tournament. The fee is deducted from the user's balance and added to the prize pool. Winners are still determined by performance ranking (processWeeklyJackpot) — never chance.
- **`enterTournament`** — Compliance (Wave 2): prize competitions are jurisdiction- and age-gated.
- **`exportAIData`** — Exports the caller's AI-related data as a single JSON payload for download. Called from AIContentHub with { data_type }. The response body is returned to the client under `.data` for the UI to serialize into a downloadable file.
- **`exportMyData`** — exportMyData (DSAR — GDPR/CCPA right to access & data portability). Returns the current user's personal data across the key entities. Read-only; logs the request to the consent ledger.
- **`gameSentimentReport`** — Allow scheduled (no auth) or admin-triggered calls
- **`gameVotingPipeline`** — ---- generate_surveys ----
- **`headToHeadContestMatchmaker`** — Headless batch call — auto-match waiting contests
- **`leaderboard`** — leaderboard (authenticated) — friendly-competition rankings. scope "friends" ranks you against your buddies + group; "global" ranks everyone. Financial metrics (earner, saver) are returned RANK-ONLY — no dollar amounts ever leave this function. Read-only.
- **`leaderboardReset`** — leaderboardReset (INTERNAL/ADMIN, scheduled daily; self-gates on cadence) — the periodic WEEKLY leaderboard reset. Per the product decision: all-time `score` is kept untouched; a SEPARATE weekly board is derived as `score - period_baseline`, and each period's winners are ARCHIVED before the
- **`recordExpense`** — recordExpense (INTERNAL/ADMIN) — log a real business expense so the growth-budget engine can account for it (marketing spend drives CAC; all expenses reduce free surplus). Body: { amount_usd, category?: "marketing"|"infra"|"ai"|"ops"|"other", note?, at? }
- **`recordTournamentMatchResult`** — Get both players' UX sessions during tournament time to verify legitimacy
- **`submitExperimentFeedback`** — submitExperimentFeedback (authenticated user) — a customer answers an A/B change-gating experiment. Their response is appended to the experiment; evaluateExperiments later decides whether the change ships. Body: { experiment_id, prefers_variant?, satisfaction?, answers? }
- **`superAgentTournamentGamification`** — === PRESTIGE & TRUST SCORES ===
- **`tax1099Export`** — tax1099Export (ADMIN) — produce filing-ready 1099-NEC records for a tax year: every recipient at/over the reportable threshold WITH a W-9 on file, with box 1 (nonemployee compensation = gross reportable) and box 4 (federal income tax withheld = backup withholding). Returns JSON rows and a CSV a f…
- **`taxProfileStatus`** — taxProfileStatus (auth, read-only) — the caller's tax/W-9 status for a payout recipient: whether a W-9 is on file, their year-to-date reportable payouts vs the 1099 threshold, whether a W-9 is required (or being approached), how much backup withholding has been applied, and the masked TIN. This i…
- **`tournamentMatchmaker`** — Fetch tournament
- **`weeklyContestWinner`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---

### Compliance, Legal, KYC, Tax, Fraud & Risk (85)

- **`acceptTerms`** — acceptTerms (Master Plan 0.5) — record the current user's acceptance of the current terms version.
- **`aiAdManagerRun`** — aiAdManagerRun (admin/service, scheduled) — the SELF-LEARNING, SELF-IMPROVING orchestrator. Each run closes a measure → learn → improve → dispatch loop for every active Tier 2 advertiser, with no per-advertiser human: 1. MEASURE — read each advertiser's real attributed ROAS and record it as a lea…
- **`aiAdManagerStatus`** — aiAdManagerStatus (auth) — the AI-managed Tier 2 delivery picture for the caller: the full A-D rate card (conventional list values vs the $200k bundle price + implied discount), and what the AI system has delivered so far given how many Tier 2 parts they've bought. Read-only; never charges.
- **`aiAgentSelfImprovementEngine`** — Analyze all agent performance data
- **`aiCampaignManager`** — Scheduled automation path: no body, no user session — bulk optimize all active campaigns
- **`aiCategoryImages`** — aiCategoryImages (INTERNAL/ADMIN, scheduled) — spins up ORIGINAL category tile images on the serverless GPU, ONCE per category. Generates for top-level categories first, then subcategories, storing each in CatalogCategory { name, level, image_url }. Skips any that already have an image, so
- **`aiDisputeAnalyzer`** — Fetch platform logs related to dispute
- **`aiDisputeEvidenceAnalyzer`** — AI-assisted dispute evidence analyzer. Called from AIDisputeAutomationDashboard with { claim_id }. Loads the claim + related platform records, runs an LLM assessment, and
- **`aiDisputeFeedbackLoop`** — Fetch recently resolved disputes with admin overrides
- **`aiDisputeResolver`** — Create a new dispute ticket
- **`aiDisputeReview`** — Fetch dispute and related data in parallel
- **`aiFraudScorer`** — Entity automation triggered on PPCSurveyResponse create
- **`aiPerformanceOptimizationSuperAgent`** — Collect system health metrics
- **`aiPolicyComplianceMonitor`** — Fetch recent transactions, disputes, and user reports
- **`aiServiceCategoryImages`** — aiServiceCategoryImages (INTERNAL/ADMIN, scheduled) — spins up ORIGINAL Services-section category tiles on the serverless GPU, ONCE per category, exactly like aiAppCategoryImages / aiCategoryImages. Top categories first, then subsections. Stored in CatalogCategory { name, level, image_url,
- **`autoAgentHealthCheck`** — 1. Check all agent performance logs for recent failures
- **`autoAgentHealthMonitor`** — Automates: agent performance evaluation, learning memory updates, self-improvement, orchestration health
- **`autoBugReportTriage`** — RULES FIRST (free): classify obvious, NON-critical bugs by keyword and acknowledge with a template, skipping the AI. Critical or ambiguous reports still get the full AI triage (suggested fix etc.).
- **`autoComplianceMonitoring`** — Monitor for compliance violations
- **`autoDeveloperManagementEngine`** — Category 8: Developer & Game Management Automation Handles: Game approval/vetting, performance analytics, developer onboarding
- **`autoDisputeClaimLifecycle`** — AI analyze evidence
- **`autoDisputeLifecycle`** — Auto-resolves disputes using AI, escalates only clear fraud
- **`autoDisputeResolution`** — Get low-confidence disputes (clear-cut cases)
- **`autoDisputeSmartResolution`** — Fetch open disputes awaiting resolution
- **`autoEngagementEngine`** — Category 2: User Engagement & Experience Automation Handles: Personalized recommendations, gamification, survey personalization, feedback integration, proactive support
- **`autoFraudReportLifecycle`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoFraudSecurityEngine`** — Category 6: Fraud Detection & Security Automation Handles: UX fraud, referral fraud, payout fraud, content moderation
- **`autoGuildManagement`** — Automates: guild challenges, leaderboards, rewards, inactive guild cleanup, member ranking
- **`autoInactivityReengagementEngine`** — Find inactive users (no activity in last 30 days, but active in past 90)
- **`autoRealTimeFraudResponse`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoRetentionRiskScorer`** — Daily: AI-score users for retention risk and auto-trigger RetentionCampaigns
- **`autoSeasonManagement`** — Automates: season creation, rank assignment, rollover, rewards distribution, leaderboard reset
- **`autoSecurityAndComplianceEngine`** — Automates: API key rotation checks, audit log analysis, admin alert notifications, competitive intelligence
- **`autoSubscriptionManager`** — Daily: manage subscription renewals, expirations, failed payment retries
- **`autoSupportAndDisputeEngine`** — Automates: support ticket triage, dispute resolution, emergency escalation, compliance, AI analysis
- **`autoSupportTicketTriage`** — Free keyword routing for the obvious tickets; the AI is reserved for the ambiguous ones.
- **`autoTrustAndFlagEngine`** — Automates: respondent trust scores, flagged responses, ABTest conclusions, push subscriptions, earnings monitor
- **`autoUXFraudAnalysis`** — Automated UX-signal fraud analysis over session/interaction telemetry.
- **`autoUXFraudEscalation`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoUserInactivityReengagement`** — Daily: identify 30-day inactive users and trigger personalized RetentionCampaigns
- **`autoVIPUserManagement`** — Identify and manage VIP users
- **`breakageReport`** — breakageReport (INTERNAL/ADMIN) — Suggestion 2 + 4. Tracks closed-loop points OUTSTANDING vs REDEEMED, recognizes breakage (the unredeemed portion = retained margin), and shows that breakage + the advertiser pool COVER the platform-funded subsidies (e.g. seller cash-back). This is where the "10%"…
- **`businessClientReengagementEngine`** — Identifies inactive/at-risk business clients and drafts re-engagement campaigns (as RetentionCampaign records with status "pending_approval") for admin review. Called from BusinessClientReengagementDashboard with {}.
- **`complianceFlags`** — complianceFlags (Master Plan 0.1) • default: return all resolved compliance flags (optionally for a jurisdiction). • { action: "set", name, enabled, disabled_jurisdictions } (ADMIN): override a flag live, no deploy.
- **`complianceProfilePropose`** — complianceProfilePropose (ADMIN, GATED) — the AI compliance research assistant, done SAFELY. Given a country, it DRAFTS a proposed compliance-profile update and writes it to a REVIEW QUEUE (ComplianceProfileProposal) as status 'pending_review'. It NEVER changes live legal behavior — a human/couns…
- **`consentStatus`** — consentStatus (Master Plan 0.3) — the current user's latest consent for a kind (+ optional version). body: { kind, version? }
- **`counselFeatureGate`** — counselFeatureGate — the single control for every gated-OFF feature flag. The list is DERIVED from the settings registry (every sensitive boolean that defaults OFF), so ANY new gated flag appears here automatically — no code change needed to surface it in the Setup Wizard. It (a) LISTS every gate…
- **`countryComplianceProfile`** — countryComplianceProfile — resolves the compliance posture to apply for the CALLER (or a requested country), auto-selected from the user's country: DB override (ComplianceProfile) → seeded registry → strict default. The frontend/app reads this to apply the right cookie-consent model, age-of-major…
- **`disputeEvidenceReview`** — Parallel data fetch: transaction logs + social media engagement
- **`dmcaCounterNotice`** — dmcaCounterNotice — a user whose content was removed files a §512(g) counter-notice. Captures the required elements (identification, good-faith-mistake statement under penalty of perjury, consent to jurisdiction + service of process, signature) and notifies the designated agent.
- **`dmcaResolve`** — dmcaResolve (admin) — record the resolution of a DMCA request and apply the content state change. body: { request_id, action: "removed" | "restored" | "rejected", notes? }
- **`dmcaTakedownRequest`** — dmcaTakedownRequest (PUBLIC) — accept a DMCA §512(c)(3) takedown notice from a rights holder (who may not be a platform user). Captures the required statutory elements, records the notice, flags the identified content for the designated agent, and emails the agent.
- **`evaluateAgentPerformance`** — Pull all performance logs for this agent
- **`featureUsageTrack`** — featureUsageTrack — records ONE feature use for the current user, feeding the PMF scoreboard's adoption / engagement / retention signals. A feature's front-end (or another backend function) calls this when the user actually uses the feature. The founding flag is read from the user so the scoreboa…
- **`fraudAlertNotifier`** — Called on a schedule (every 30 min) OR triggered manually from admin Detects: click spikes, rapid sign-ups with no conversion, suspicious link patterns
- **`fraudDetector`** — Flags suspicious survey behavior (e.g. 5+ suspiciously fast completions).
- **`fraudScanEngine`** — Fetch recent survey responses
- **`funnelReengageEmail`** — funnelReengageEmail (INTERNAL/ADMIN) — sends ONE compliant AI-concierge re-engagement email to a customer. A business/CRM/scheduled job triggers this per customer; the customer cannot trigger it for others. HARD GATES (all must pass or it skips, never sends):
- **`funnelReengageSweep`** — funnelReengageSweep (INTERNAL/ADMIN, meant to be SCHEDULED, e.g. daily) — walks active funnel journeys whose commitment window has CLOSED and fires the Gate-2 re-engagement email to each eligible, opted-in customer, on its own. Every send obeys the same hard gates as funnelReengageEmail:
- **`getTaxonomy`** — getTaxonomy (authenticated) — returns the hierarchical product taxonomy for the category browser: top categories → subcategories, plus any AI-generated category tile images and browse-node counts. Body (optional): { category?: string } — if given, returns that category's subcategories + browse no…
- **`groupMessages`** — groupMessages (authenticated) — recent group chat. Membership-only. Read-only. Body: { session_id, limit? }
- **`groupSendMessage`** — groupSendMessage (authenticated) — post an encouragement to your group. Same protections as buddy chat: answer-wall (no sharing survey answers) + anti-scam guard (no off-platform/payment/contact/links) + rate limit. Stored (retained for moderation).
- **`languageReference`** — languageReference — returns/refreshes the translation reference: the (estimated) count of languages & dialects and a PANGRAM per script (a font-coverage/display sample, NOT a translation mechanism). Optionally renders each pangram to an IMAGE for font preview (gated PANGRAM_IMAGES, bounded). Stor…
- **`maintenanceAgentRun`** — maintenanceAgentRun — the site-maintenance AI. Sibling of the scaling advisor: same advisory, human-gated, server-authoritative guardrails (agent-guardrails.ts), different job. On a schedule it gathers real health signals, runs the pure assessHealth() decision core, writes a MaintenanceReport, an…
- **`manageLesson`** — INCREMENT 5 — Lesson safety controls. An admin can VETO a bad lesson (excluded from what agents recall) or PIN a good one (always recalled). This is the human guard so a wrong "lesson" can't quietly degrade an agent.
- **`opsCoverageStatus`** — opsCoverageStatus (INTERNAL/ADMIN) — is the batch-approval desk covered 24/7? Returns who's on right now, today's hour-by-hour coverage, and any gaps to fill so a batch is never left waiting. Body: {} → { fully_covered, on_now, today, gaps_today, shifts }
- **`pmfRevenueAgentRun`** — pmfRevenueAgentRun — the AI PMF & revenue agent's scheduled pass. Collects the feature/site signals, ranks the portfolio for product-market fit (retention-weighted) and revenue, records learning, and writes an advisory plan (human-gated execution — no money/price/legal changed automatically). Aut…
- **`realtimeFraudMonitor`** — Allow scheduled/admin calls
- **`recordConsent`** — recordConsent (Master Plan 0.3) — append a consent/disclosure record for the current user. body: { kind, version?, accepted?, shown?, meta? }
- **`recordCookieConsent`** — recordCookieConsent — records a visitor's cookie/tracking privacy choice to the append-only consent ledger for auditability (GDPR "demonstrate consent" / CCPA record-keeping). Works for signed-in users and anonymous visitors (anon → a stable-ish anon id from the body, else "anon"). Never blocks; …
- **`revenueStreamCoverage`** — revenueStreamCoverage — admin READ of the COMPLETE revenue-stream coverage map: every one of the ~45 revenue sub-points across all 8 categories, each with its real revenue, status, live/pending, and whether it's a tiered advertiser feature. Guarantees no stream is invisible — the companion to the…
- **`shoppingConsent`** — shoppingConsent (authenticated) — the explicit opt-in gate for the shopping browser extension. The extension may NOT ingest any purchase until the user has granted this consent in-app. Consent is the USER's, recorded here — never inferred from the extension, a page, or a tool claiming prior autho…
- **`stepUpChallenge`** — stepUpChallenge — the client calls this before a sensitive action to learn whether a fresh re-auth is needed and which methods are acceptable (passkey / password / otp / vendor face). The client then performs one of them at the edge and calls stepUpVerify. Read-only.
- **`stepUpVerify`** — stepUpVerify — records a COMPLETED step-up after the client performed it. The server VALIDATES the proof per method, then writes a StepUpVerification row that the sensitive-action gate (requireStepUp) reads. The actual capture happened at the edge/vendor; here we verify and record. Method verific…
- **`submitTaxInfo`** — submitTaxInfo — a user submits their W-9 tax information (required before we can pay them at or above the 1099 threshold without backup withholding). Stores a TaxProfile and logs the certification to the consent ledger.
- **`superAgentPlatformOps`** — === DAILY NOTIFICATIONS ===
- **`taxComplianceReport`** — taxComplianceReport (admin) — for a tax year, aggregate reportable payouts per user from the money ledger, compare to the 1099 threshold, and return: who needs a 1099 (W-9 on file, export-ready), and who needs BACKUP WITHHOLDING (over threshold but no W-9). Reports surface only the masked TIN.
- **`termsStatus`** — termsStatus (Master Plan 0.5) — does the current user need to (re)accept the current terms version?
- **`trackCRMEmailEngagement`** — Tracks email open/click events and updates lead status accordingly
- **`translateAgent`** — translateAgent — translate text into the user's language AND specific dialect. The LLM handles essentially any language/dialect directly from the text (no screenshots, no per-language install); then we apply the self-learned dialect GLOSSARY (regional term overrides) on top, so accuracy for a spe…
- **`usageFeeApply`** — usageFeeApply — the GATED daily job that charges the uniform usage fee. For each active user it charges ONLY from AVAILABLE earned rewards (the `points` / Site Cash field), never more than is available (NO DEBT — a user can never owe), never past the cap, and once per day (idempotent per user+day…
- **`usageFeeStatus`** — usageFeeStatus — read-only view of the uniform daily usage fee for the signed-in user: today's fee, how much of the cap they've paid, how much cap remains, the one extra survey that offsets it, and the honest disclosure line. Moves nothing. Reports enabled=false while the fee is gated off (pendin…
- **`verifyBusinessClient`** — Support both direct calls and entity automation payloads
- **`verifyCampaignOutcomes`** — Check if user completed surveys after the campaign was sent
- **`verifyWithdrawalRequest`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---

### AI, Agents, Optimization & Autonomy (99)

- **`abTestAssigner`** — ACTION: assign — return which variant to show this user
- **`adminOptimizationDecide`** — adminOptimizationDecide (ADMIN) — approve or reject a pending AI recommendation (the money/legal- sensitive ones the optimizer would not apply on its own). Approving applies the change (clamped by coerce to the registry bounds), audit-logs it, and opens an outcome row so the AI measures and
- **`adminOptimizationReview`** — adminOptimizationReview (ADMIN) — everything the AI Optimization dashboard needs: pending recommendations awaiting approval, recently applied changes and their measured outcomes/lift, the per-setting learning memory, and the latest signal snapshot. Read-only.
- **`aiAdDiscovery`** — Gather user context in parallel
- **`aiAutoApprovalWorkflow`** — Fetch pending payouts for approval
- **`aiAutomaticFeatureImplementation`** — Get latest competitive intelligence and UX analysis
- **`aiBudgetReallocation`** — Daily AI-driven budget reallocation across all active campaigns Can be called manually or via scheduled automation
- **`aiCampaignAutomation`** — Scheduled daily: auto-generate and activate referral campaigns for top users
- **`aiChurnPredictionEngine`** — Get users with low engagement
- **`aiCodeDebugAssistant`** — Fetch bug reports
- **`aiCompetitiveIntelligenceEngine`** — Search for competitive intelligence across multiple dimensions
- **`aiCompetitorMonitoringEngine`** — Define key competitors to monitor
- **`aiContentGeneratorAndShare`** — Get high-earning users for content generation
- **`aiContentPerformanceOptimizer`** — Analyze posted content performance
- **`aiControlPause`** — aiControlPause (ADMIN) — the STOP button. Engage (paused:true) to instantly halt all AI-driven changes (optimizer pass, self-learning, autonomous auto-apply). Release (paused:false) to resume. Body: { paused: boolean }
- **`aiControlStatus`** — aiControlStatus (ADMIN) — the real-time AI oversight view: is the AI paused, and what has it been doing lately (newest first). The frontend polls this to show a live feed. Body: { limit? }
- **`aiCorrectionSubmit`** — aiCorrectionSubmit (ADMIN) — a human corrects something the AI did and pushes the fix. If it targets a safe (non-compliance) setting, the corrected value is applied immediately. Either way the correction is recorded and fed back as a learning signal, so the AI learns from the human fix on the nex…
- **`aiFeedbackABOptimizer`** — Gather survey feedback and A/B test results
- **`aiFinancialAuditEngine`** — Fetch financial data
- **`aiFunnelCommit`** — aiFunnelCommit — the customer picked a product; start its commitment window. Upserts the active journey. This records intent + starts the clock; it does NOT charge (payment runs through the normal purchase flow). Body: { product_key: string }
- **`aiFunnelRecommend`** — aiFunnelRecommend (Gate 1 — fit) — a recommendation from the conversation signals, BEFORE purchase. Deterministic + logged. The suitability guard means a financial product is never recommended as an upsell unless it is live AND ability-to-repay is confirmed.
- **`aiFunnelResultsReview`** — aiFunnelResultsReview (Gate 2 — results) — after the commitment window, recommend up / down / hold from the customer's REAL results on the product's metric (attributed sales / earnings / engagement value). Truthful individualized numbers only. Suitability guard still applies to any financial upsell.
- **`aiGenerateContentLibrary`** — AI-generates a reusable library of marketing/creative content assets.
- **`aiGlobalDecide`** — aiGlobalDecide (ADMIN) — during the daily peak-time review window, promote an individually-approved change SITE-WIDE, or reject it. Only works while the window is open (the human check is once/24h). Body: { experiment_id, action: "apply" | "reject" }
- **`aiGlobalReview`** — aiGlobalReview (ADMIN) — the once-per-24h, peak-time human check. Returns whether the daily review window is open right now, and the changes that passed individual-user statistical approval and are waiting to be promoted site-wide. Approvals are only allowed while the window is open (aiGlobalDeci…
- **`aiHostedFallbackRun`** — aiHostedFallbackRun — the advertiser "backup channel." When a product isn't converting on social (weak CTR / few conversions despite enough impressions), this launches a live-shopping session hosted by an AI PRESENTER the advertiser configured for their target demographic, rendered on Abacus.AI (…
- **`aiIdentifyBusinessClients`** — Use InvokeLLM to generate business prospect profiles
- **`aiLTVPredictionEngine`** — Get active users with transaction history
- **`aiMarketAdvisorEngine`** — Batch daily delivery for all active users
- **`aiMarketIntelligenceEngine`** — Allow scheduled/headless calls; only block non-admin authenticated users
- **`aiMarketingCopyGenerator`** — Generates compelling marketing copy for referral campaigns
- **`aiModelReadiness`** — aiModelReadiness — admin READ of the AI's autonomy posture and progress toward the "fully working by <target>" milestone: the live auto-apply mode (apply / advisory / off) and WHY, the non-sensitive autonomy default, the permanent-gate count that stays human-gated no matter what, the founding-dat…
- **`aiOnboardingPersonalizer`** — Called when a new user registers (entity automation on User create)
- **`aiOptimizerRun`** — aiOptimizerRun (INTERNAL/ADMIN, scheduled daily) — one full self-learning optimization cycle over EVERY optimizable setting: collect signals → measure past outcomes (keep wins, revert losses) → recommend → auto-apply non-sensitive within bounds, queue money/legal-sensitive for approval.
- **`aiOrchestrator`** — Step 1: Quality scan
- **`aiPersonalizedCoachingEngine`** — Get affiliate's performance data
- **`aiPlatformInsights`** — On-demand: generates AI insights across the full platform
- **`aiPriceEngine`** — Sort listings by total_landed_cost
- **`aiPricingOptimizer`** — aiPricingOptimizer (INTERNAL/ADMIN, scheduled) — the pricing loop only: tunes the price/economy settings from store, membership, contest, and customer pricing-survey data. All price changes are money-sensitive, so this produces recommendations for admin approval (never silent price moves).
- **`aiRetentionOptimizer`** — Get at-risk users
- **`aiRevenueForecaster`** — Get historical transaction data by date
- **`aiStrategicInsightsEngine`** — Fetch comprehensive platform metrics
- **`aiSupportEngine`** — Allow both user-context and service-role headless calls
- **`aiUniversalOptimizationEngine`** — Get all AI feature performance data
- **`aiUserRetention`** — Scheduled daily: identify at-risk users and send personalized retention messages
- **`analyzeClaimEvidence`** — Build AI prompt for evidence analysis
- **`autoABTestLifecycle`** — Initialize A/B test — set start time, assign initial variant split
- **`autoABTestWinner`** — Fetch completed A/B tests
- **`autoActivityFeedPersonalizer`** — Daily: refresh personalized UserRecommendation records based on activity
- **`autoAdReviewAndOptimization`** — Automates: ad listing review, ad fraud detection, bid optimization, ad performance tracking, sentiment
- **`autoAdminAuditAIAnalysis`** — Daily: AI analysis of AdminAuditLog for anomalies and security threats
- **`autoCompetitiveIntelligence`** — Fetch market competitors/businesses
- **`autoDailyOperationsEngine`** — Automates: all daily scheduled operations — AI survey generation, tier checks, streak reminders, realtime fraud monitoring, milestone alerts, referral commissions, PayPal reconciliation, MLM earnings aggregation, content creation, data analytics, developer management
- **`autoDailyPlatformHealthEngine`** — Automates: daily platform health checks, batch daily goal generation, smart payout scheduling, business client setup, payout advance engine, personalized offers expiry, dynamic pricing
- **`autoDailyScheduledOps`** — Daily operations: generate new daily challenges, refresh AI daily surveys, send streak reminders, expire old promo codes, clean up stale sessions
- **`autoEmailSequenceEngine`** — Automates: welcome emails, referral emails, re-engagement, weekly reports, milestone emails, withdrawal notifications
- **`autoHourlyPlatformOptimizer`** — 1. Update active ad campaign performance stats (simulate real-time data)
- **`autoMarketingCampaignEngine`** — Automates: marketing campaign lifecycle, performance tracking, auto-pause/resume, ROI analysis
- **`autoMarketingCampaignLauncher`** — Hourly: launch scheduled MarketingCampaigns and EmailMarketingFlows
- **`autoPersonalizedEmailSequences`** — Fetch users eligible for email nurture sequences
- **`autoRetentionCampaigns`** — Skip users with recent campaigns
- **`autoSettingsOptimization`** — Auto-optimize notification preferences based on engagement
- **`autoUserRecommendationRefresh`** — Daily: refresh personalized recommendations for active users and notify them
- **`autoWishlistOptimization`** — Get wishlist
- **`autonomyApprove`** — autonomyApprove — the generic human gate for any domain's pending decision (money/legal decisions that never auto, plus auto_ok domains that haven't earned autonomy yet). approve (optionally 'tweaked') or reject. The decision is the training signal the kernel uses to graduate a domain to autonomy…
- **`autonomyDecide`** — autonomyDecide — the reusable GATE any automated process calls before acting. Give it a domain + a proposal; it computes that domain's trust, asks the kernel, records an AutonomyDecision, and tells the caller whether it may act now (auto_approve) or must wait for a human. This is the single plumb…
- **`autonomySetMode`** — autonomySetMode — set a domain's autonomy mode (manual | earned | full) from the Command Center. A permanent-gate domain (money / identity / legal / risk) cannot be changed — it stays human-gated by design. Raising a domain to "full" is an owner decision; "billing_change" and anything with public…
- **`autonomyStatus`** — autonomyStatus — the Automation Command Center payload: every domain, its class (can-graduate vs permanent human gate), its live autonomy mode, its TRUST meter (how close to auto), and how many decisions are waiting for a human. One read of the shared decision + feedback history, grouped in memor…
- **`batchDailyGoalGenerator`** — Only process users active in last 14 days
- **`buildUserAIProfiles`** — buildUserAIProfiles (INTERNAL/ADMIN, scheduled) — refresh the compiled AI profile for recently active users so personalization stays current. Each user's per-visit call also compiles their own.
- **`churnPredictionEngine`** — Skip brand-new users
- **`dailyTierCheck`** — Tier 1 → Check if user earned $3 today via DailyEarnings
- **`emailMarketingAutomation`** — Daily email throttle — max 1 automated email per user per day
- **`enrichCRMProspectsAI`** — Fetch new prospects awaiting enrichment
- **`featurePmfScoreboard`** — featurePmfScoreboard — admin READ of the retention-weighted PMF scoreboard for the dashboard. Returns the latest stored snapshot when present, else computes live. Includes the per-tier "which features earn the most" revenue ranking the owner asked for.
- **`featurePmfScoreboardRun`** — featurePmfScoreboardRun — recomputes the retention-weighted Feature PMF scoreboard and stores a snapshot. Wired to the scheduler to run continuously (PMF discovery keeps going after launch). Authorized for an admin (dashboard "recompute now") OR the scheduler's server-signed service token (same p…
- **`funnelBenchmarkCompile`** — funnelBenchmarkCompile (INTERNAL/ADMIN, meant to be SCHEDULED) — the AI that keeps the site's "results information" current on its own. It aggregates REAL per-customer results per product from customers who have COMPLETED the product's window, and — only once the sample is big enough — publishes …
- **`generateAIDailyGoal`** — Get user's historical earnings data
- **`generatePersonalizedOutreach`** — Fetch prospect details
- **`maintenanceApplyProposal`** — maintenanceApplyProposal — the ONE audited path that actually executes a maintenance proposal. Everything the maintenance agent might "fix" flows through here, so there is a single choke point for the guardrails. It: • re-classifies the proposal through the shared guardrails (never trusts the cal…
- **`masterOrchestrator`** — ═══════════════════════════════════════════════════════════ PHASE 1: FRAUD & SECURITY (always runs first) ═══════════════════════════════════════════════════════════
- **`membershipDailyFee`** — membershipDailyFee — runs once/day (scheduler, service token). • Auto-activates Premium membership for any user whose account is >= 1 day old (unless they opted out), and records the fee disclosure in the immutable consent ledger.
- **`optimizeDynamicPricing`** — Fetch products with sales velocity data
- **`oversightApprove`** — Human approves a queued agent action. Marks the AutomationReview approved, then RE-INVOKES the original action with an approvalToken so it passes the oversight gate and actually executes. Reuses the existing in-process functions.invoke — no new infra.
- **`oversightPending`** — Lists agent actions awaiting human approval (the overseer's inbox). Reads the existing AutomationReview entity so the existing dashboards can render it with no schema change.
- **`oversightReject`** — Human rejects a queued agent action. The action never executes; the record is kept for audit. Reuses the existing AutomationReview entity.
- **`predictAndPreventChurn`** — Fetch users with subscription data
- **`providerAdvisor`** — providerAdvisor (ADMIN) — the self-host recommendation panel's data. For each AI capability it returns this month's REAL hosted spend, a run-rate projection, the self-hosted GPU break-even, whether to switch to self-hosting now, the current provider, and the exact setting + steps to flip. Free-ti…
- **`retentionCampaignEngine`** — Get all active retention risks at the target levels
- **`revenueHubOrchestrator`** — ── 1. Subscription churn prevention ──────────────────────────────────
- **`runDailyFeedbackAnalysis`** — Scheduled function: runs each evening, finds today's survey and triggers AI analysis
- **`saveToGetClaim`** — saveToGetClaim (auth) — claim an item once its goal is fully funded from the user's own savings. The reserved Site Cash (already moved out of spendable as they saved) is consumed and the item is marked claimed. Fulfillment (creating the actual order/entitlement) runs through the normal order flow…
- **`scaleAdvisor`** — scaleAdvisor — the SAFE "AI scaling agent". Given live load metrics it reports (a) the CONFIG changes the auto-scale governor would apply automatically (render → serverless GPU, cache, replica, concurrency, AI tier), and (b) INFRASTRUCTURE recommendations that a human (or the cloud auto-scaler) s…
- **`sendDailyReminder`** — Verify admin or scheduled invocation
- **`smartContentSchedulingOptimizer`** — Get the user's social media posts and engagement data
- **`trackABTestMetrics`** — Entity automation: triggered on PPCSurveyResponse create/update
- **`triggerEmailMarketing`** — Compliance (Wave 2 / CAN-SPAM): only send marketing email to opted-in users; gated by the email_marketing kill-switch. Transactional email (via Core.SendEmail elsewhere) is unaffected.
- **`userPersonalized`** — userPersonalized (authenticated user) — called on each visit. Compiles the user's AI profile and returns custom recommendations + an AI chatbot opener tuned to drive engagement and purchases, grounded in both the user's profile and the evolving site model.
- **`wishlistAISuggest`** — wishlistAISuggest (authenticated) — AI keeps the wishlist growing: from the user's profile + what they've already wished for, suggest more products and add them (source "ai" → shows under "Picked for you"). Cheap model tier; de-duped. Can be called on demand or by a scheduled job.

### Infra, Scaling, Scheduling & Maintenance (22)

- **`adScheduledReports`** — Runs daily — sends reports to advertisers who have scheduled report delivery enabled Respects each user's report_frequency preference: 'daily', 'weekly' (Mondays), 'monthly' (1st)
- **`autoAuditLogMonitoring`** — Auto-analyzes audit logs and flags anomalies for admin review
- **`autoDeveloperInstallBudgetMonitor`** — 80% budget warning
- **`autoMonthlyReconciliation`** — 1. Reconcile all completed transactions for the month
- **`autoReconciliationReportGenerator`** — Weekly: generate ReconciliationReport for financial and data consistency
- **`autoSeasonScheduler`** — Scheduled daily: transition season statuses and recalculate SeasonRank scores
- **`autoTransactionReconciliation`** — Automates: transaction reconciliation, revenue distribution, developer payouts, daily tier checks
- **`autoWeeklyScheduledOps`** — Weekly operations: process jackpot, contest winners, top earner rewards, weekly leaderboard reset, streak bonus calculation
- **`autoWishlistPriceDropMonitor`** — Hourly: monitor ProductWishlistItems for price drops and alert users
- **`cloneTemplateToSchedule`** — Get template
- **`competitorAlertMonitor`** — Define competitors to monitor
- **`infraScaleController`** — infraScaleController — the ACTING, in-platform, Claude-based scaling agent. Each tick it takes the live load, computes how many instances the platform should be running, and — when enabled — calls your cloud's scaling API (webhook→Lambda, or Railway) to set that instance count. It scales CAPACITY…
- **`premiumAutoRenewSweep`** — premiumAutoRenewSweep — scheduled/admin. Drives the consumer PREMIUM default auto-renewal posture, entirely gated behind PREMIUM_AUTORENEW_ENABLED (OFF + counsel-gated). For each active membership approaching its expiry it sends the ADVANCE reminder (~30d) and FINAL warning (~24h) by email + acco…
- **`priceDropMonitor`** — Update the item with new best price
- **`priceMonitoringEngine`** — Fetch user's wishlist items
- **`reconciliationEngine`** — Create report record
- **`resilientGovernorRun`** — resilientGovernorRun — the scaling-helper AI's monitor for on-device fallback. On a schedule (every minute) it reads current load, decides the resilient state with hysteresis, and writes RESILIENT_AUTO_STATE — which systemLoadSignal serves to clients, so users are automatically switched to on-dev…
- **`scaleGovernorRun`** — scaleGovernorRun — the GATED auto-scale job. Reads live load metrics, decides which scale levers to flip (up under load, back down when it subsides, with hysteresis), and applies the changes by writing settings the rest of the platform reads (render provider → serverless GPU, caches on, read-repl…
- **`scaleStatus`** — scaleStatus — read-only: the auto-scale switch state and each lever's current value vs. its base/scaled targets, so the Setup Wizard / ops console can show what's scaled and what would scale next. Admin only.
- **`sweepstakesFreeEntry`** — sweepstakesFreeEntry — the NO-PURCHASE-NECESSARY (AMOE) path into the current weekly prize pool. Grants ONE free entry per period per user, with the SAME eligibility and odds as a paid entry. Offering a genuine free entry breaks the "consideration" prong, which keeps the prize pool a legal
- **`systemLoadSignal`** — systemLoadSignal — the tiny, cheap signal the CLIENT polls to know whether to fall back to on-device mode. Returns a load state so the app can automatically shift to serving reads/UI/AI from the device (and queue non-sensitive writes) when the server is under pressure — and come back online when …
- **`tierAutoRenewSweep`** — tierAutoRenewSweep — scheduled/admin. Drives the Tier 2/3 DEFAULT auto-renewal posture (owner request), entirely gated behind TIER_AUTORENEW_ENABLED (OFF + counsel-gated). For each in-term Tier 2/3 seat that is enrolled (opt-out posture) and approaching its annual boundary it:

### Admin, Settings & Config (9)

- **`adminAlertNotifier`** — --- LARGE WITHDRAWAL ALERT ---
- **`adminAuditLogAnalyzer`** — Group by user
- **`adminCosmeticUpsert`** — adminCosmeticUpsert (admin) — curate the closed-loop cosmetics catalog. Create or update a CosmeticItem by `key` (upsert), set its price in Site Cash / rarity / image / active flag, or deactivate it. Admin-gated. Never touches user funds or ownership — catalog metadata only.
- **`adminSettingsUpdate`** — adminSettingsUpdate (ADMIN) — set one or more settings. Each change is validated against the registry, written to GlobalSettings (DB override wins over env), and recorded in AdminAuditLog. Body: { updates: [{ key, value }, ...] } OR { key, value }
- **`autoAdminOperations`** — Handles all remaining unautomated admin operations: - Auto-approve low-risk custom domain requests - Auto-generate weekly reconciliation reports
- **`autoAdminOpsEngine`** — Category 5: Admin & Operations Automation Handles: Game rotation, order fulfillment, user management, audit logging, dispute resolution
- **`autoGlobalSettingsBroadcast`** — Maintenance mode toggle
- **`autoPartnerTierAndSettings`** — Auto-manages partner tiers, notification prefs, payout settings for all users
- **`mobileOtaConfig`** — mobileOtaConfig (PUBLIC, no auth) — the runtime control installed mobile apps read BEFORE applying any over-the-air web-bundle update. Returns whether OTA is currently allowed and which channel to pull from. This is the app-store-policy safety valve: flip MOBILE_OTA_ENABLED off and installed apps…

### Telemetry, Analytics, Reporting & Insights (12)

- **`autoDataAnalyticsEngine`** — Category 7: Data Analysis & Insights Automation Handles: Market trend reports, user behavior analytics, predictive analytics, A/B test analysis
- **`autoWeeklyInsightsReport`** — Gather weekly stats
- **`autoWeeklyReportsEngine`** — Automates: weekly contest winners, weekly ad reports, weekly top earners, revenue forecasting, LTV prediction, competitive intelligence, retention optimization, AI platform insights
- **`flywheelMetrics`** — flywheelMetrics (ADMIN) — the live health of the profit flywheel (PROFIT-FLYWHEEL blueprint §4/§7). Computes the handful of numbers that tell you whether the wheel is spinning: engaged users, ad impressions per session, ad revenue, viral coefficient, and outstanding Site Cash. Every metric is bes…
- **`generateMarketTrendReport`** — Aggregate game engagement and install data by category
- **`platformInsights`** — platformInsights (ADMIN / brand-facing) — the compliant seed of the market-research supply business (flywheel #1). Returns AGGREGATE-only, consent-gated audience/survey insights that brands and researchers pay for. HARD privacy guarantees, by construction:
- **`recordVariantMetric`** — recordVariantMetric (authenticated) — report an outcome or guardrail metric for the current user, attributed to their assigned variant in every running live experiment. This is how the live A/B learns what users actually DO. Common metrics: "purchase", "click_through", "add_to_cart",
- **`revenueReport`** — revenueReport (INTERNAL/ADMIN) — the single source of truth across every non-customer revenue stream. Sums the RevenueEvent ledger by type over a window, adds an estimated BREAKAGE figure (B14: outstanding closed-loop points assumed never redeemed × recognition rate), and proves the invariant tha…
- **`revenueStackReport`** — revenueStackReport (INTERNAL/ADMIN) — measures the BLENDED $200k/year revenue stack over a 5-year horizon. Reporting only: reads the unified RevenueEvent ledger, annualizes each business-funded line, compares the blend to the target, splits sales-driven vs activity-driven, and projects the stack …
- **`sendWeeklyAdReport`** — Allow both scheduled (service role) and manual (authenticated user) calls
- **`telemetryIngest`** — telemetryIngest (authenticated) — ONE coalesced write for the client. It (1) always persists the raw journey rows (UserJourneyEvent — the existing journey log, independent of the telemetry flag), and (2) stores the compact statistical aggregate (InteractionEvent) when telemetry is enabled + sampled.
- **`telemetryStats`** — telemetryStats (INTERNAL/ADMIN) — compute the statistical breakdown of interaction telemetry (event distribution, top pages, catalog funnel rates, scroll depth, drop-off) and publish the headline metrics as OptimizationSignal rows so the site model + self-learning loop consume them.

### Notifications, Messaging & Email (14)

- **`autoNotificationEngine`** — Automates: push notifications, email reminders, survey alerts, payout alerts, streak reminders, weekly top earners
- **`autoPromoCodeLifecycleNotifier`** — Broadcast new promo code to eligible users
- **`autoSmartNotificationRuleEnforcer`** — Hourly: evaluate SmartNotificationRules and batch-deliver filtered survey notifications
- **`autoSubscriptionLifecycleNotifier`** — Welcome subscription email
- **`autoUserSuggestionStatusNotifier`** — Award bonus XP when implemented
- **`notifyHighQualityResponse`** — Entity automation: triggered when a PPCSurveyResponse is created/updated
- **`partnerNotificationWebhook`** — Optional shared-secret guard: when PARTNER_WEBHOOK_SECRET is set, callers must send it as x-partner-webhook-secret so this internal notification hook can't be spoofed. Unset = open (dev).
- **`registerPushToken`** — Stores a device's native push token (FCM/APNs) so the server can send push notifications. Called by the mobile app's native layer (src/lib/native.js) after it registers for push. Idempotent per (user, token): updates if the token already exists, else creates.
- **`sendPushNotification`** — Validate admin or self
- **`sendWithdrawalNotification`** — Only trigger when status changes TO 'completed'
- **`smsOptInConfirm`** — smsOptInConfirm (auth) — complete the double opt-in: flips a pending consent to CONFIRMED with a timestamp. This represents the user completing the confirmation step (e.g. replying YES to the confirmation text or clicking the confirmation link). Recorded as durable proof of verifiable consent.
- **`smsOptInRequest`** — smsOptInRequest (auth) — the user submits their number and explicitly agrees to the SMS consent language. Records a PENDING consent with the exact disclosure shown + timestamp + IP (the durable, auditable proof). Double opt-in: a confirmation step (smsOptInConfirm) completes it. This does NOT sen…
- **`smsOptInRevoke`** — smsOptInRevoke (auth) — the STOP path. Marks SMS consent revoked immediately. Honoring opt-out is mandatory (TCPA), so this must always succeed and take effect at once.
- **`smsOptInStatus`** — smsOptInStatus (read) — the caller's current SMS consent + the exact disclosure that would be shown.

### Localization & Global (10)

- **`autoVirtualCurrencySync`** — Sync UserInventory balance
- **`convertCurrency`** — convertCurrency — convert an amount between currencies using the latest LIVE rates (cached by currencyRates, checked against the internet feed). For display/pricing help; Site Cash stays a closed-loop unit and authoritative money handling stays server-side. Gated behind CURRENCY_LIVE_FX_ENABLED.
- **`currencyRates`** — currencyRates — fetches LIVE exchange rates from an internet FX feed (Frankfurter by default: no key needed) and caches them (CurrencyRate). This is what keeps currency conversion checked against a live feed. Refreshes only when the cache is stale (FX_CACHE_MINUTES) unless force=true. Gated behin…
- **`jurisdictionCheck`** — jurisdictionCheck (Master Plan 0.2) — resolve what's allowed for a state/country (e.g. "US-CA"). body: { jurisdiction?, feature?, prize_value? } (falls back to the user's stored jurisdiction/state)
- **`localizeContent`** — localizeContent — the reusable culturalization service. When a feature, product, sale, or service is created, any create-flow calls this to adapt the content to a target country's LANGUAGE and CUSTOMS (not just a literal translation). Returns the adapted content plus cultural_notes for human revi…
- **`localizePrices`** — localizePrices — the reusable hook any shop/catalog screen calls to show prices in the user's LOCAL currency. Give it a list of items each with a base-currency price; it returns them with display_price / display_currency / display_formatted using the cached live FX rates. DISPLAY ONLY — the autho…
- **`multilingualTranslator`** — Use LLM to translate
- **`translateText`** — Tiny stable hash for cache keys (keeps keys bounded regardless of string length).
- **`translationCorrection`** — translationCorrection — the self-learning input. A user (or a native speaker) corrects a translated term for a specific dialect; we remember it. The same correction seen enough times GRADUATES from the user's personal glossary into the SHARED glossary for that dialect, so everyone's translations …
- **`userCurrencyPreference`** — userCurrencyPreference — the user-settings currency picker. A user can OVERRIDE their auto-detected currency, or clear the override to go back to auto-detect. Purely a DISPLAY preference (which currency prices are shown in); orders are still charged in Site Cash. The user only ever changes their …

### Membership, Onboarding & Accounts (20)

- **`autoAccountQualityScoring`** — Fetch new user accounts for quality check
- **`autoBusinessClientOnboarding`** — Create OnboardingProgress
- **`autoPremiumMembershipLifecycle`** — Automated premium-membership lifecycle (activation, renewal, lapse) management.
- **`autoProfileCompletion`** — Generate suggested profile completion based on user data
- **`autoProfileSetup`** — Auto-generates a display name from email when user has no full_name set
- **`autoRegisterBusinessClient`** — Support entity automation payload (Transaction create trigger)
- **`autoUserOnboardingEngine`** — Automates: new user onboarding, CRM lead processing, referral setup, social connection verification, retention risk detection, activity feed fan-out, contest entry validation
- **`autoUserOnboardingSequence`** — Create OnboardingProgress record
- **`businessSignup`** — businessSignup (A6) — a business/seller/advertiser joins. Records the one-time sign-up (+ optional onboarding) fee as platform revenue and activates the account. This is a BUSINESS charge — never a customer markup. Actual card collection is handled by the processor once card_charging is live; this
- **`costFloorProfile`** — costFloorProfile (ADMIN) — one action that pulls EVERY cost lever to the floor while keeping every feature ON. It routes each AI/media capability to the cheapest backend (your self-hosted server if its URL is set, otherwise the FREE tiers), forces LLM calls to the small Llama model, turns off pai…
- **`deleteMyAccount`** — deleteMyAccount (DSAR — GDPR/CCPA right to erasure). Anonymizes and deactivates the account. Financial / ledger records are RETAINED in de-identified form (tax + anti-fraud legal obligation), but the profile PII is scrubbed. Requires an explicit { confirm: true }.
- **`demoLogin`** — Reviewer / demo login. Returns a ready JWT for a seeded demo account so an App Store / Play reviewer (or a tester) can get into a populated app in one tap — no signup, no real data. GATED: only works when REVIEWER_DEMO=1 is set in the backend env. Off by default.
- **`householdAddMember`** — householdAddMember (holder only) — add an existing member by email as an adult or teen. Body: { email, role: "adult"|"teen", spend_limit_usd? }. TEEN role requires the teen_accounts flag (OFF until counsel sign-off); while OFF, teen invites are refused with a clear message.
- **`householdCreate`** — householdCreate (authenticated) — the caller becomes the ADULT account holder of a new Household. Body: { name?, confirm_adult: true }. The holder must attest they're 18+ (the platform is 18+).
- **`householdRemoveMember`** — householdRemoveMember (holder only) — remove a member from the household. The holder can't remove themselves (dissolving a household is a separate action). Body: { member_user_id }
- **`householdSetLimit`** — householdSetLimit (holder only) — set a teen member's per-order auto-approve limit. Orders at/under the limit skip approval; anything above still needs the holder's sign-off. 0 = approve every order. Body: { member_user_id, spend_limit_usd }
- **`householdStatus`** — householdStatus (authenticated) — everything the Family & Teens page needs for the caller: • holder → the household, its active members, and the orders awaiting their approval; • member → the household they belong to and their role;
- **`registerSupplier`** — registerSupplier (INTERNAL/ADMIN) — connect a dropship/wholesale supplier so the AI can fulfill through it automatically. The API key lives in an ENV var (named here); never stored in the DB. Body: { name, api_base, api_key_env, order_path?, wholesale?, active? }
- **`sellerActivateMembership`** — sellerActivateMembership — the seller's ONE TAP that turns on using the site as a USER and unlocks their held cash-back. By tapping, the seller agrees to use the platform as BOTH a seller AND a user for a year (SELLER_USER_COMMITMENT_MONTHS). This is part of seller onboarding — one click, no paym…
- **`sellerSignupOneClick`** — sellerSignupOneClick — ONE TAP to become a seller. Because fulfillment is AI-automated and the economy is closed-loop, any user can open a storefront instantly; there's no separate seller account — the account username IS the seller name. The tap also activates member use (so cash-back / curator …

### Revenue, Pricing & Monetization (16)

- **`autoActivityFeedPopulator`** — Entity trigger: creates ActivityFeedItems for key UserActivity events
- **`autoBusinessClientRevenueCalc`** — Daily: recalculate BusinessClient total_revenue from all game orders and transactions
- **`autoDynamicPricingEngine`** — Daily: AI-powered dynamic pricing adjustments for Products
- **`autoPriceAndWishlistEngine`** — Automates: price monitoring, price drops, wishlist optimization, auto-add products, BNPL tracking
- **`autoStreamerSubscriptionLifecycle`** — Welcome subscriber
- **`autoSubscriptionEngine`** — Automates: subscription renewals, expiry, downgrade, billing reminders, creator subscriptions. STRICT-STANDARD: an auto-renewal is only applied when the strict recurring-billing guard permits it (express consent on file + not opted out). A subscription flagged auto_renew but WITHOUT consent is not
- **`autoSubscriptionLifecycle`** — New subscription → welcome email + onboarding notification
- **`calculateWhiteLabelRevenue`** — Fetch white label partner
- **`feedbackAutoCollect`** — feedbackAutoCollect — the AUTOMATIC collector. It mines the behavioral telemetry the site already captures on every page (InteractionEvent: dwell time, scroll, friction points, purchases) and turns it into implicit feedback signals attributed to the right autonomy DOMAIN — so the AI learns from w…
- **`feedbackStatus`** — feedbackStatus — the admin rollup of everything the site has learned from customer interactions: per-surface and per-domain feedback (mostly IMPLICIT — conversions, completions, dwell — collected automatically), the net sentiment, and the loudest problems (reports). Admin only.
- **`feedbackSubmit`** — feedbackSubmit — the ONE endpoint every customer-interaction surface calls to record feedback (a thumbs, a rating, "was this helpful?", a report, or an implicit conversion/completion/dwell signal). It persists the event AND emits a learning signal, so every surface both invites feedback and impro…
- **`hostingStatus`** — hostingStatus (authenticated) — "earn $4 today → unlock hosting." Returns today's earnings vs the unlock threshold, whether hosting is unlocked, and the $1/day membership fee that comes out of those earnings. Any earning source counts (surveys, offers, buddy chat), so this is what the UI polls to…
- **`ingestPricingFeedback`** — ingestPricingFeedback (authenticated user) — records a user's answers to an AI-generated pricing survey into PricingFeedback, the dataset aiPricingOptimizer reads. Accepts the raw responses and derives a representative acceptable price_point (Van Westendorp "cheap"/"expensive" midpoint, or a
- **`priceAlertChecker`** — Fetch all active wishlist items with alerts enabled
- **`revenueLeversStatus`** — revenueLeversStatus (admin) — the governance view of every monetization sub-point across all 8 categories: each lever's status (built / gated / counsel), what it books to, what it's gated by, and (for gated) what external account it still needs. Also totals live REVENUE by ledger type from the Re…
- **`submitFeedbackResponse`** — Check if already submitted

### Platform, Utilities & Miscellaneous (147)

- **`affirmConfirm`** — affirmConfirm (authenticated buyer) — after the buyer completes Affirm.js, the client sends back the checkout_token. We AUTHORIZE then CAPTURE the charge with Affirm (merchant is paid upfront; Affirm owns the default risk), then atomically claim the listing and open a fulfilled order. Real goods …
- **`analyzeCompetitorTrends`** — Top 5 competitor profiles (these would be configured in a real system)
- **`analyzeProspectResponseAndPause`** — Fetch the sequence
- **`approveGroupSpend`** — Group owner approves (or rejects) a pending spend request and executes it.
- **`attributeOutcomes`** — INCREMENT 4 — Real outcome attribution. Increment 1 records a PROVISIONAL success ("the run finished without erroring"). This grounds learning in REAL results by reading DomainEvents (what actually happened) and
- **`autoApiKeyRotationCheck`** — Monitors integration health and sends admin alerts for any failures
- **`autoBusinessClientSetup`** — Auto-reviews and activates developer/business client accounts
- **`autoCRMAndLeadEngine`** — Automates: CRM lead scoring, segmentation, follow-ups, campaign assignments, VIP management
- **`autoCRMHighPotentialEngine`** — Automation engine: scans CRM prospects, identifies high-potential ones via AI, drafts personalized outreach emails, and sends them automatically.
- **`autoCRMLeadLifecycle`** — AI qualify the lead
- **`autoChallengeAndEventLifecycle`** — DailyChallenge created → broadcast to all users
- **`autoContentCreationEngine`** — Category 3: Content Creation & Management Automation Handles: Ad content, social media posts, game review summaries, mockup generation
- **`autoContentPerformanceScoring`** — Fetch content/games with engagement data
- **`autoDeveloperApplicationLifecycle`** — AI review score the application
- **`autoDeveloperSupportTicketLifecycle`** — AI classify and auto-respond to developer support
- **`autoEmergencySupportEscalation`** — Get high-priority support tickets
- **`autoFeatureRequestClustering`** — Fetch feature requests
- **`autoFinancialEngine`** — Category 4: Financial & Payouts Automation Handles: Smart payout recommendations, automated processing, BNPL, reconciliation
- **`autoFlaggedResponseLifecycle`** — AI re-analyze the flagged response
- **`autoGuildLifecycle`** — Notify guild founder
- **`autoIAPAdvertisingCreditRecalc`** — Notify developer when significant new credit available
- **`autoIAPProcessor`** — Grants inventory/currency — must not be callable by arbitrary public clients. Accept an internal invoke, an admin, or a request bearing the configured IAP webhook secret (set IAP_WEBHOOK_SECRET and have the store/proxy send it as x-iap-webhook-secret when wiring a real app-store webhook).
- **`autoInAppPurchaseLifecycle`** — Send receipt
- **`autoInAppPurchaseProcessing`** — Record transaction
- **`autoInstallCountAggregator`** — Triggered when DeveloperInstallCost is updated — syncs total_installs to Game + BusinessClient
- **`autoLargePurchaseApproval`** — Auto-approves orders + places external orders — not callable by arbitrary public clients.
- **`autoMarketingAutomationEngine`** — Category 1: Marketing & Sales Automation Handles: Referral optimization, affiliate management, retention, wishlist virality, social media, ad optimization
- **`autoMockupVoteConclusion`** — AI-generate implementation spec for winners
- **`autoPromoCodeLifecycle`** — New promo code → broadcast to relevant users via AI targeting
- **`autoPublishContentCalendar`** — Get affiliate's approved content schedule for today
- **`autoSeasonLifecycle`** — Season ended — distribute top-100 rewards
- **`autoSeasonRankLifecycle`** — New season → announce to all active users
- **`autoStreamSessionLifecycle`** — Stream started — notify followers
- **`autoStreamerTipLifecycle`** — Notify streamer
- **`autoStreamingAndContentEngine`** — Automates: stream session lifecycle, YouTube embeds, analytics, game guides, social token refresh
- **`autoSupportTicketEngine`** — Automates: support ticket triage, developer support tickets, withdrawal request processing, payout status notifications, VIP escalation, SLA enforcement
- **`autoSupportTicketLifecycle`** — AI auto-triage and reply
- **`autoTransactionAnomalyDetector`** — Flag anomalous transactions: large amounts, duplicate within 1 min, unusual type
- **`autoUserSegmentation`** — Fetch active users for segmentation
- **`autoUserSuggestionLifecycle`** — Get today's feedback survey
- **`autoWishlistItemLifecycle`** — Confirm item added to wishlist
- **`autoWishlistShareLifecycle`** — Jackpot entries only where prize competitions are allowed for the sharer's jurisdiction; elsewhere they still earn wishlist credit but no sweepstakes entries (payout is gated too).
- **`autoWishlistSharing`** — Check if user has referrals
- **`autoWithdrawalApproval`** — Auto-approves or denies withdrawal requests using AI fraud scoring
- **`autoWithdrawalRequestLifecycle`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`autoYouTubeSessionLifecycle`** — Award XP based on watch percentage
- **`automationGuardianHealer`** — Only admins can trigger this
- **`autonomousEcosystemEngine`** — ---- 1. Load or create the ecosystem config ----
- **`banAppealScorer`** — Scores a user's ban appeal and recommends an action for admin review. Referenced by the universal_admin_action_agent. Accepts the appeal details (plus optional user_id), pulls the user's history, and returns an LLM-backed
- **`bankTowardItem`** — bankTowardItem (authenticated) — the user marks an item as a savings goal ("bank toward this"). Progress is tracked live against their Site Cash balance (see savingsGoalStatus); when their earned Site Cash covers the price, they're notified and can redeem — the item ships fully covered. No cash
- **`burstComplete`** — burstComplete (authenticated) — record that the user finished a burst unit (a survey / AdGrid unit) so the on-the-go tracker advances and stays in sync across devices. The actual earning is credited by the survey postbacks; this only tracks burst COUNT + last-active. Upserts the day's BurstSession.
- **`burstDayStatus`** — burstDayStatus (authenticated) — the on-the-go daily progress: $ earned today vs the goal, bursts done, chosen pace, and the burst config. Powers the progress bar and the "next burst ready" prompt. Read-only.
- **`burstNext`** — burstNext (authenticated) — decide the user's NEXT burst unit. Order: goal reached → shortest available BitLabs survey → AdGrid top-up (if access) → other enabled provider → nothing right now. The client passes the BitLabs surveys it currently sees (with length), so we pick the shortest for a qui…
- **`businessSubscribe`** — businessSubscribe (A7) — a business subscribes to a monthly B2B SaaS tier (basic/pro/enterprise) for analytics, priority placement, more survey slots, audience access. Recurring business revenue that replaces the customer markup. Records the first month's revenue and sets the tier.
- **`buyingDeskBatchApprove`** — buyingDeskBatchApprove (INTERNAL/ADMIN) — a team member has placed these orders at the retailer(s) by hand; mark the tasks placed and move their orders to awaiting_shipment (optionally with tracking). One click clears a whole batch. Idempotent per task.
- **`buyingDeskQueue`** — buyingDeskQueue (INTERNAL/ADMIN) — the manual fallback queue: orders with no sanctioned auto-channel that a team member places by hand. Returns pending tasks for the buying-desk UI (batch-approvable). Body: { status? = "pending", limit? }
- **`calculateBNPLFamilyRequirement`** — Calculate users needed ($4/day per person = $120/month)
- **`calculateGlobalPrestige`** — Weighted scoring (max 1000 pts)
- **`calculateTrustScore`** — Entity automation: triggered on PPCSurveyResponse create/update
- **`chargeInstallCPI`** — Get or create developer install cost record
- **`checkAndAwardBadges`** — Check each badge criteria
- **`classifyResponseThemes`** — Gather all open-text answers
- **`computeUserTrustScore`** — Auth check for non-scheduled calls
- **`concludeWeeklyFeatureVote`** — Concludes any active feature-vote survey whose window has closed: correlates responses, ranks candidates by votes, picks the winner, generates an implementation spec, records a FeatureMockup, and hands the winner to
- **`contributeToGroup`** — A member contributes credits from their balance into the group pool.
- **`createAudiencePanel`** — createAudiencePanel (B23) — a business pays to run a survey/campaign against a TARGETED audience segment (e.g. a demographic, an interest, a country). Records the panel revenue and creates the panel spec the survey engine targets. Businesses pay; customers don't. (Data products must stay aggregat…
- **`createGroupGoal`** — createGroupGoal — start a COMPLIANT group goal (each member keeps their own points; NO shared pool). The creator becomes the owner + first member, and their current lifetime earnings are snapshotted as their baseline so only earnings from here forward count toward the shared goal. Returns an invi…
- **`crossPromoNudge`** — crossPromoNudge (authenticated) — the flywheel's cross-promotion brain (PROFIT-FLYWHEEL blueprint §3). Given the transition the user just reached ("context"), returns the ONE best OTHER avenue to point them at (refer / spend / Premium / shopping / social / survey), server-authoritatively — eligib…
- **`detectSuspiciousResponses`** — Entity automation: triggered on PPCSurveyResponse create/update
- **`equipCosmetic`** — equipCosmetic (authenticated) — equip (or unequip) a cosmetic the caller OWNS. One equipped item per type (equipping a new avatar_frame unequips the old one). No money moves here — purely a display toggle over the caller's own UserCosmetic rows.
- **`featureMockupPipeline`** — --- generate_mockups ---
- **`fetchAutomatedBills`** — In production, integrate with Plaid, Open Banking APIs, or email parsing For now, simulate fetching from email summaries or bank connections
- **`generateSupportTicketDossier`** — Fetch the ticket
- **`generateWishlistShareLink`** — Generate unique referral code
- **`graduationScan`** — graduationScan (INTERNAL/ADMIN, scheduled) — promotes segment winners to the whole site. For each segment experiment that won strongly (nominated when its lift ≥ GRADUATION_LIFT_PCT), it opens a site-wide 24h validation experiment. If that clears significance + guardrails, the normal tick()
- **`groupCreate`** — groupCreate (authenticated) — start an earn-together group of a size YOU choose (clamped to admin bounds). You're the first member; others join until it's full. Body: { size, topic? } → { session_id, size }
- **`groupGoalStatus`** — groupGoalStatus (authenticated, READ-ONLY) — reports progress. Nothing is moved or mutated here; it only READS each member's own current earnings and SUMS the individual progress toward the shared goal. Body: { group_id? }
- **`groupJoin`** — groupJoin (authenticated) — join an earn-together group. With session_id, joins that group; otherwise matches you into any open group with room, or opens a new one at the default size. Fills to the group's chosen size, then marks it active.
- **`groupLeave`** — groupLeave (authenticated) — leave a group (optionally reporting it). Removes you from the roster; if the group empties it ends. A report is surfaced to moderators. Body: { session_id, reason? } → { success }
- **`groupStartOneOnOne`** — groupStartOneOnOne (authenticated) — the consent-progressive path to 1:1: after sharing a GROUP session, two members can MUTUALLY opt into a private 1:1 (which becomes a normal buddy pair, with all its chat protections). It only activates once BOTH have opted in. In-app only — no contact-info exc…
- **`groupStatus`** — groupStatus (authenticated) — the group's members with today's progress, size, and status. Membership-only. Body: { session_id } → { size, status, members:[{display_name, earned_today, is_me}] }
- **`humanInputHarvester`** — INCREMENT 3 — Route human-input surfaces through data-driven AI. surveyIngest already turns feedback-survey responses into SurveySignals. This generalizes that to EVERY human-input surface — game votes, site-layout/mockup votes, feature votes,
- **`identifyAndEnrollUnderperformers`** — Get all referrals from last 30 days
- **`inventoryStatus`** — inventoryStatus (admin, read) — the live ad-inventory picture: DAU-derived annual capacity, what's committed to active advertisers, remaining headroom, and how many more Tier 1 / Tier 2 seats can be sold without overselling. Use it to size how many advertisers your current audience can actually c…
- **`itemOwnershipPlan`** — itemOwnershipPlan (authenticated) — the "how many minutes of surveys to own this?" calculator. Given an item (listing_id or price_usd), returns: the user's CURRENT ownership % from their earned Site Cash, the minutes/days to reach each ownership milestone at their tier's earn rate, and how much
- **`joinGroupGoal`** — joinGroupGoal — join a friend's group goal by invite code. The joiner's CURRENT lifetime earnings are snapshotted as their baseline, so only what they earn from here forward counts toward the shared goal. No value is pooled or transferred — the member simply starts contributing their own progress.
- **`logAutomationReview`** — Create review item in database
- **`matchAdsToSearch`** — Get user's search/engagement history
- **`milestoneAlertChecker`** — Get all DailyEarnings records from today to find users who recently crossed a milestone
- **`moneyLedgerView`** — moneyLedgerView (Master Plan 0.4) — ADMIN view of the immutable money-movement audit log. body: { user_id?, type?, limit? }
- **`oneClickPurchase`** — oneClickPurchase (authenticated) — Amazon-style "Buy now". It LOGS the order immediately in an awaiting_payment state, so the user's intent is captured in one click, and: • if a card is on file AND card charging is enabled, the order is flagged ready for the processor to
- **`opsAssignShift`** — opsAssignShift (INTERNAL/ADMIN) — assign a paid operator (staff/contractor) a recurring UTC coverage window for the batch-approval desk, or deactivate one. Operators run the company's own fulfillment. Body: { operator_user_id?, operator_name, tz?, start_hour_utc, end_hour_utc, days?:[0-6], active…
- **`premiumAcceptOffer`** — premiumAcceptOffer — the user's ONE TAP that turns an EARNED offer into Premium enrollment. The tap IS the consent: by accepting, the user agrees to (1) posting clearly-marked #ad promotional content and (2) the one-year program term — exactly the two consents loyaltyEnroll captures, recorded
- **`premiumAdDecide`** — premiumAdDecide (authenticated) — the member acts on a queued ad post: • "auto_post": try to post it via the platform API (only works where the app has approved access); on failure it stays queued and the member is told to copy & paste instead.
- **`premiumAdFree`** — premiumAdFree (authenticated) — the premium "skip ads by watching one extra ad a day" option. The extra "9th minute" is a 60-second SPONSORED full-screen ad; advertisers OPT IN to sponsor it (as part of their offer) and pay for the premium impression — that is the platform's revenue. The benefit …
- **`premiumAdQueue`** — premiumAdQueue (authenticated) — the member's queue of AI-generated ad posts awaiting their OK. Each is already #ad-disclosed and lightly tailored to the platform. The member either one-tap posts (where auto-post is available) or copies it and pastes it into their own app — both are compliant.
- **`premiumAutoRenewOptOut`** — premiumAutoRenewOptOut (authenticated) — the member's control over Premium auto-renewal (the "click to cancel" path the law requires): { } → read status
- **`premiumEligibility`** — premiumEligibility — read-only check: has this user EARNED the one-tap Premium offer? The bargain the owner set: complete the daily survey goal (SURVEY_DAILY_GOAL_USD gross, default $8) on at least PREMIUM_AUTOQUALIFY_DAYS days (default 260 = 5 days/week × 52 weeks) within the trailing
- **`premiumFinanceStart`** — premiumFinanceStart (authenticated) — enroll in Premium with NO upfront charge. Premium is granted immediately; $1/day is then deducted from earned Site Cash toward the price over the cycle. Pay-as-you-earn from rewards — nothing is fronted, so it isn't credit. If the price is never covered the m…
- **`premiumFinanceStatus`** — premiumFinanceStatus (authenticated) — the member's financed-Premium progress: membership % paid, Site Cash overpayment building, monthly earning total vs the successful-month target, and days left in the cycle. Read-only.
- **`proactiveSupportAnalyzer`** — Auto-respond to tickets that have no admin_notes yet
- **`processAutomationReview`** — Fetch the review item
- **`processCRMDripSequences`** — Fetch all active email sequences
- **`processWithdrawalRequest`** — --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
- **`profitSummary`** — profitSummary (INTERNAL/ADMIN) — the plain "what's my profit" view: money IN vs money OUT over a window, routed through PayPal, plus the RevenueEvent business-revenue and Expense ledgers. profit = in − out. This is the simple admin number; the Growth Engine adds the reserve-aware "what's safe to …
- **`promoValue`** — promoValue (PUBLIC, no auth) — the advertised promotional figures for the landing/signup hero and marketing, from a single source of truth (settings). Keep the displayed number truthful with "up to" + disclosure (see WELCOME-REWARDS-AND-VALUE-STACK.md).
- **`purchaseCosmetic`** — purchaseCosmetic (authenticated) — buy a closed-loop cosmetic with non-cashable Site Cash (current_balance, USD store credit). NO real-money purchase, NO cash value, non-tradeable — a pure Site-Cash SINK, so it stays inside the closed-loop / non-money-transmission model. The debit is ATOMIC (adju…
- **`purchasePaybackStatus`** — purchasePaybackStatus (authenticated) — the "earn it back" TRACKER. It shows how much real money the user has spent (card/BNPL orders) and how much they've EARNED so far (in closed-loop points they can spend on-platform), as progress toward "earning back" what they spent.
- **`realtimeAdBiddingEngine`** — slot_request contains targeting info: { user_id, geo, interests, device, ad_format, placement }
- **`recordContentLicense`** — recordContentLicense (auth) — log a content-license/rights attestation for uploaded content (ad creatives, storefront media). Called by the uploader's client after they check the rights-attestation box. GET-style (no accepted flag) returns the current license text + version to display. Records to…
- **`recordMatchResult`** — Records a game/contest match result and updates participant standings.
- **`relistItem`** — relistItem (authenticated member) — turn something you own into a marketplace listing WITHOUT exposing any personal information. The listing shows an anonymized seller ("GamerGain Member"), is buyable with points or card, and its order is handled by the AI order-fulfillment lifecycle.
- **`requestGroupSpend`** — Requests to spend from the group pool — a large-ticket purchase or a transfer to a member. If the requester is the group owner, it executes immediately; otherwise it is created as pending for owner approval (approveGroupSpend).
- **`roasBiddingEngine`** — Fetch all active campaigns for this user (or specific one)
- **`saveToGetCancel`** — saveToGetCancel (auth) — cancel a goal and move its reserved savings BACK to spendable. Proves nothing is locked: the user reclaims every cent, no penalty, no balance owed. Body: { goal_id }
- **`saveToGetContribute`** — saveToGetContribute (auth) — move a chosen amount of the user's OWN spendable Site Cash into a goal's reservation. Optionally update the goal's auto_pct too. Nothing owed; reversible via cancel. Body: { goal_id, amount_usd, auto_pct? }
- **`saveToGetCreate`** — saveToGetCreate (auth) — start a savings goal for an item. Creates the goal only; no money moves until the user contributes. Optionally set auto_pct (share of new earnings to auto-route here; 0 = off). Body: { item_name, item_price_usd, auto_pct?, product_ref? }
- **`saveToGetStatus`** — saveToGetStatus (read) — the caller's Save-to-Get goals + config + disclosures. Nothing owed anywhere.
- **`savingsGoalStatus`** — savingsGoalStatus (authenticated) — live progress on the user's "bank toward this item" goals, measured against their current Site Cash balance. Fires a one-time "you're covered!" notification the first time a goal is fully covered (idempotent via notified_covered). Read-mostly.
- **`sellerActivationStatus`** — sellerActivationStatus — read-only state for the seller onboarding UI: is the seller activated as a member, how much cash-back is currently LOCKED awaiting one-click activation, and the commitment term they'd agree to. Drives whether the "unlock your cash-back" banner shows.
- **`sendComebackIncentive`** — Daily email throttle — max 1 automated email per user per day
- **`sessionCaptureAnalyzeBatch`** — sessionCaptureAnalyzeBatch (INTERNAL/ADMIN, scheduled) — turns the cheap STRUCTURAL snapshots (UXHeatmapSnapshot: scroll depth, click coords, dead/rage clicks, element boxes) into UX findings. This is almost entirely RULE-BASED, so it costs ~$0 — no per-frame vision LLM. It aggregates by page,
- **`sessionCaptureIngest`** — sessionCaptureIngest (authenticated) — the client asks (action:"check") whether the current session is in the rotating sample; if so it periodically POSTs a tiny STRUCTURAL snapshot (action:"snapshot": viewport, scroll depth, click coords, element boxes — no pixels, ~1 KB, near-zero cost). A legacy
- **`sessionControl`** — sessionControl — the server-authoritative record of WHO currently holds scoped control in a session (the "borrow functionality / co-op" capability). The host grants control to another player for in-game input ONLY; the scope guard (canGrantControl) refuses anything touching the OS, navigation, ac…
- **`sessionEnd`** — sessionEnd (authenticated) — call this on LOGOUT (and best-effort on app background). It closes the user's session; the metrics recorded during it have already fed the per-segment aggregates, which the scheduled monitor evaluates. A change that reaches a statistically positive result is then appl…
- **`sessionHostAssign`** — sessionHostAssign — the authenticated caller requests to HOST a room (a game, a stream, or screen-mirroring). The server verifies THEIR eligibility (it can trust its own earnings data, not a client-reported score) and, if eligible, the caller becomes the host; otherwise the server hosts. Records …
- **`sessionRecording`** — sessionRecording — register and list recordings/clips of a hosted session (Tier-3 capability). The bytes live in object storage (the client uploads there and passes the URL); this only stores METADATA + moderation state, so the DB never holds media. A recording is created as `pending_moderation` …
- **`sessionStart`** — sessionStart (authenticated) — call this on LOGIN and on native app-resume. It resolves the user's effective variant overrides for their segment (running experiments + segment-kept promoted changes), snapshots the kept-change state, and returns the overrides for the client to apply. This is the
- **`setBurstPace`** — setBurstPace (authenticated) — the user picks their pace: "survey" (one survey at a time), "timed" (a 60-second sprint), or "count" (a set number of units). Stored on the day's BurstSession. Upsert. Body: { pace } → { success, pace }
- **`setupStatus`** — setupStatus (INTERNAL/ADMIN) — the go-live wizard's data: a live checklist of what's connected, what's on, and the exact next action for anything that isn't. Everything ships ON by default; the only "action" items are external accounts/keys only the owner can provide (PayPal, product feed, a drop…
- **`spendBalance`** — Server-authoritative balance DEBIT. Balance fields are server-only (the client can't write them via /auth/updateMe), so debits flow through here. Checks funds server-side, deducts, ledgers to Transaction, and can grant
- **`submitFeatureVote`** — Records a user's votes on the weekly feature/game survey, credits the $0.10 reward once, and prevents double-voting. Called from the WeeklyFeatureVote page.
- **`submitMockupVote`** — ── SCHEDULED TALLY — no action/body (called by automation) ──────────
- **`submitSessionRating`** — submitSessionRating (authenticated user) — end-of-session rating: one rating meant for the app store and one internal site rating (each 1–5), plus optional comments. Both default to 5 in the UI. Body: { app_store_rating, site_rating, comments?, session_id? }
- **`tenantRegistry`** — tenantRegistry (ADMIN) — the rewards-as-a-service control plane (flywheel #2). Lists tenant brands running on your rails and (POST) registers/updates one. Multi-tenancy is a seam: off by default (you're the only tenant), but the registry + resolver are built so onboarding a brand later is config,…
- **`tierAutoRenewOptOut`** — tierAutoRenewOptOut (authenticated) — how a Tier 2/3 seat-holder controls the DEFAULT auto-renewal: { } → read status (enrolled?, next renewal, notice windows) { opt_out: true } → opt OUT of auto-renewal (term ends at year boundary; no charge)
- **`trackAdClick`** — Records a click on a PPC ad. Called fire-and-forget from PPCAdSearchWidget with { adId, searchQuery }. Increments the listing's click count and logs the click.
- **`trendChoiceNext`** — trendChoiceNext — show the user a FAIR set of current-event topics to pick from. Options are drawn uniformly (no ranking, no momentum ordering) and their display order is randomized, so no option is favored. Every shown option is logged as an impression, so results can be scored as exposure-norma…
- **`trendChoiceResults`** — trendChoiceResults — the unbiased ranking of current-event topics by EXPOSURE-NORMALIZED pick-rate (picks ÷ times-shown), so an option shown more can never win on exposure. Includes a fairness diagnostic (how equal exposure was). Optionally (apply:true) nudges the winning topics' momentum up in t…
- **`trendChoiceVote`** — trendChoiceVote — record which current-event topic the user picked from a fair set. The pick is logged (for exposure-normalized pick-rate) AND emitted as a learning signal on the "video" domain, so user interest in current events automatically steers which topics the content engine rides — no cli…
- **`tutorialGuidebook`** — tutorialGuidebook — the downloadable guidebook, rendered from the SAME single source as the in-app tutorial (tutorial-content.ts) so the two never drift. Two actions: • default / "get" — return the guidebook Markdown so the client can show it or let the user DOWNLOAD it.
- **`tutorialProgress`** — tutorialProgress — save/get a user's progress through the interactive tutorial, and mark it complete. On first completion it can grant a small Site-Cash reward (config; 0 = none). Site Cash only — a member reward, never real money. Gated behind TUTORIAL_ENABLED.
- **`tutorialSteps`** — tutorialSteps — returns the interactive tutorial steps for a track (business | non_business) for the in-app coach-marks. Optionally translates the visible copy into the user's language/dialect (when AUTO_TRANSLATE is on) using the same LLM path as the translation agent, so the tutorial is availab…
- **`updateUserTiers`** — Try update if exists
- **`uxAnalysisEngine`** — Fetch recent UX events
- **`wishlistGet`** — wishlistGet (authenticated) — the user's wishlist, split into what THEY added vs what the AI picked. Body: {} → { mine: [...], ai: [...] }
- **`youtubeAutoEmbed`** — Headless/batch invocation — return gracefully

---

## 4. User-facing surfaces (pages) — 272

*Each is a distinct application screen/route in the web + mobile app.*

`ABTestingCenter`, `AIAdDiscovery`, `AIAgents`, `AIAgentsCommandCenter`, `AIAgentsSettings`, `AIAutomationCenter`, `AIAutomationLearningDashboard`, `AIContentHub`, `AIDisputeAutomationDashboard`, `AIDisputeResolutionCenter`, `AIFeedbackABDashboard`, `AIFinancialAdvisor`, `AIFunnelConcierge`, `AIGeneratorPage`, `AIGrowthAssistant`, `AILTVDashboard`, `AILiveOversight`, `AIMarketPulse`, `AIOptimization`, `AIOrderForm`, `AIOrderFulfillmentDashboard`, `AIPayoutSchedulerPage`, `AIRevenueTracker`, `AIShoppingAssistant`, `AISocialMediaEngine`, `AIVideoStudio`, `AccessibilityStatement`, `AchievementsPage`, `AdBusinessDashboard`, `AdBusinessOverview`, `AdCampaignManager`, `AdCampaignOptimizerPage`, `AdCreativeABTestingDashboard`, `AdFraudDashboard`, `AdGridSurvey`, `AdMarketplace`, `AdSentimentAnalysis`, `AddStoreCredit`, `AdminAffiliatePayoutDashboard`, `AdminAuditLogs`, `AdminCredentials`, `AdminDashboard`, `AdminDisputeResolution`, `AdminGlobalSettings`, `AdminGrowthHeatmap`, `AdminLocalizationPanel`, `AdminPricingFeedback`, `AdminProfitCalculator`, `AdminRiskMonitoring`, `AdminSettings`, `AdminUsers`, `AdminVideoEngine`, `AdvancedInsights`, `AdvancedSurveyAnalytics`, `AffiliateAnalyticsDashboard`, `AffiliateChurnMonitor`, `AffiliateContentSchedulerCalendar`, `AffiliateDisputeCenter`, `AffiliateGrowthCampaignDashboard`, `AffiliateMLMDashboard`, `AffiliateMarketingPage`, `AffiliateMarketplace`, `AffiliateOnboarding`, `AffiliatePayoutManager`, `AffiliatePortal`, `AffiliateTierDashboard`, `AgentIntelligenceDashboard`, `AgentLearningDashboard`, `AgentOversightQueue`, `Apply`, `AutomationCommandCenter`, `AutomationGuardianDashboard`, `AutomationReviewDashboard`, `BusinessClientReengagementDashboard`, `BusinessDashboard`, `BusinessPortal`, `BusinessSurveyAnalytics`, `BuyingDesk`, `CRMDashboard`, `Campaigns`, `Categories`, `Challenges`, `ChatRooms`, `ClientAnalyticsDashboard`, `CompetitiveMonitoringDashboard`, `CompetitorAlertFeed`, `CompetitorIntelligenceDashboard`, `CompleteProfile`, `ConceptPolls`, `ContactUs`, `ContentLibraryBrowser`, `ContestEntries`, `CosmeticsStore`, `CreativeStudio`, `CreatorDashboard`, `CreatorMarketplace`, `DailyChallenges`, `DailyEarningStreak`, `DailyTodoList`, `DevABTesting`, `DevBugReports`, `DevEngagementAnalytics`, `DevFinancialDashboard`, `DeveloperAIDashboard`, `DeveloperAnalytics`, `DeveloperAnalyticsDashboard`, `DeveloperDisputeCenter`, `DeveloperEarningsDashboard`, `DeveloperEventManagement`, `DeveloperIAPDashboard`, `DeveloperLeaderboards`, `DeveloperOnboarding`, `DeveloperPayoutDashboard`, `DeveloperPortfolio`, `DeveloperRevenueAnalytics`, `DeveloperToolsHub`, `DigitalStore`, `DisputeAutoApprovalSettings`, `DisputeCenter`, `DisputeClaimsUser`, `DisputeResolverCenter`, `EarnOnTheGo`, `EarnedAdvertiserLedger`, `EarningsInsights`, `EarningsSimulatorPage`, `EarningsWhatIf`, `EventsManagement`, `ExploreSurveys`, `FairTopicPicker`, `FeaturePMF`, `FeaturedGameDashboard`, `FeedbackAdminDashboard`, `FlywheelDashboard`, `ForgotPassword`, `FoundingAdvertiser`, `FoundingUpgrade`, `GameAnalyticsDashboard`, `GameDetail`, `GameGuides`, `GameMonetizationDashboard`, `GameVotingHub`, `GamerTournamentDashboard`, `Gamification`, `GetExtension`, `GetGoodsAdvance`, `GiftBoost`, `GlobalLeaderboard`, `GlobalPrestigeHub`, `GoogleAdsOverlay`, `GrowthEngine`, `GrowthEngineHub`, `GuildDetails`, `Guilds`, `HeadToHeadContest`, `Home`, `Household`, `InAppGameStore`, `InAppStore`, `IntegrationSettings`, `JoinAndConnect`, `KYCSurveyAdmin`, `Leaderboard`, `LevelAndBadgesPage`, `Login`, `ManagePayouts`, `MarketAdvisor`, `MarketTrendReport`, `MarketingAssetRepository`, `Marketplace`, `MonetizationHub`, `MoneyTransfer`, `MovieStarGenerator`, `MyOrders`, `MyPayouts`, `MyPurchases`, `NotificationHistory`, `NotificationInbox`, `NotificationSettings`, `OpsConsole`, `PPCMarketplace`, `PPCSurveyBuilder`, `PaidPPCAdsMosaic`, `PartnerOnboarding`, `PayPalManagement`, `PayoutHistory`, `PayoutMarketplace`, `PayoutSettings`, `PayoutStatus`, `PhysicalStore`, `PremiumBoost`, `Pricing`, `PrivacyPolicy`, `ProductResults`, `Profit`, `ProfitOptimization`, `ProviderAdvisor`, `Quests`, `QuickSurveyBuilder`, `RealtimeFraudMonitorDashboard`, `ReengagementDashboard`, `ReferralAnalytics`, `ReferralCompetition`, `ReferralContest`, `ReferralDashboard`, `ReferralFraudDetectionDashboard`, `ReferralGrowthEngine`, `ReferralHub`, `ReferralInvite`, `ReferralLeaderboardPage`, `ReferralSquads`, `ReferralTracking`, `ResetPassword`, `RespondentProfile`, `RetentionEngine`, `RevenueHub`, `RevenueLevers`, `RevenueStack`, `ReviewerLogin`, `RewardsMarketplace`, `SalesAnalyticsDashboard`, `SaveToGet`, `SellerUpload`, `Services`, `ServicesStore`, `Settings`, `SetupWizard`, `SharedWalletGroups`, `Signup`, `SiteCashExtras`, `SmartNotificationEngine`, `SmartPayoutDashboard`, `SocialAuthCallback`, `SocialMediaAdPoster`, `SocialMediaGenerator`, `SocialMediaSetup`, `Store`, `StreamerAnalytics`, `SubmitDisputeWizard`, `Support`, `SupportTicketDossierViewer`, `SurveyAdminDashboard`, `SurveyAnalytics`, `SurveyEmbedManager`, `SurveyIntelligenceDashboard`, `SurveyMarketplace`, `SurveyProfile`, `SurveyStudio`, `SurveyTemplateBuilder`, `Surveys`, `TermsOfService`, `ThirdPartySellerMarketplace`, `Tier1Financed`, `Tier1SelfPaced`, `Tier2Scaling`, `TournamentDetails`, `Tournaments`, `UXHeatmapDashboard`, `UpfrontEarningsPage`, `UserAnalytics`, `UserDashboard`, `UserInbox`, `UserProfile`, `ViralContentDashboard`, `VirtualStore`, `WeeklyFeatureVote`, `WeeklyLeaderboard`, `WeeklyReferralContest`, `WhiteLabelSetup`, `Wishlist`, `WishlistIntelligence`, `WishlistSharerLeaderboardPage`, `Withdrawal`

---

## 5. Data model — persisted entity types (364)

*Each is a stored record type in the platform's database (Postgres JSONB-backed).*

`ABTest`, `AIActivityLog`, `AIAgentTask`, `AICorrection`, `AIEarningsMonitor`, `AIFeedbackAnalysis`, `AILearningState`, `APIAccessKey`, `Achievement`, `ActivityFeedItem`, `AdAsset`, `AdCampaign`, `AdCreativeTest`, `AdGridAd`, `AdGridResponse`, `AdGridSession`, `AdGridSlotGrant`, `AdImpression`, `AdLearningMemory`, `AdListing`, `AdSchedule`, `AdTargetingRule`, `AdTemplateMarketplace`, `AdTemplatePurchase`, `AdTransaction`, `AdminAuditLog`, `AdminCredential`, `AdvertiserApplication`, `AdvertiserMakeGood`, `AdvertiserReport`, `AdvertiserReportedRevenue`, `AffiliateAccount`, `AffiliateAdPost`, `AffiliateChurnPrediction`, `AffiliateContentSchedule`, `AffiliateDispute`, `AffiliateGrowthCampaign`, `AffiliateOnboarding`, `AffiliatePerformanceSnapshot`, `AffiliateProduct`, `AffiliatePurchase`, `AffiliateReferral`, `AffiliateSale`, `AffiliateTier`, `AgentLearningMemory`, `AgentPerformanceLog`, `AppLog`, `AppStorePrice`, `AssistantMemory`, `AutomatedPayment`, `AutomationReview`, `BNPLFamilyMember`, `Badge`, `BuddyMessage`, `BuddyNextSession`, `BuddyPair`, `BuddyVoiceClip`, `BugReport`, `BurstSession`, `BusinessAccount`, `BusinessClient`, `BusinessSubscription`, `BuyingDeskTask`, `CRMAutomation`, `CRMLead`, `CRMLeadConversion`, `CRMOutreach`, `CRMProspect`, `CRMSegment`, `CatalogBrowseNode`, `CatalogCategory`, `ChatMessage`, `CloudSave`, `CompetitorAlert`, `CompetitorTrendAnalysis`, `ComplianceFlag`, `ComplianceProfile`, `ComplianceProfileProposal`, `ConsentRecord`, `ContentLibraryTemplate`, `ContestParticipation`, `ContestPowerUp`, `ContestVerification`, `CosmeticItem`, `CreatorPayout`, `CreatorProfile`, `CreatorSubscriptionTier`, `CrowdfundingCampaign`, `CurrencyRate`, `CustomReferralLink`, `CustomSubdomain`, `DMCARequest`, `DailyAISurvey`, `DailyChallenge`, `DailyEarnings`, `DailyFeedbackSurvey`, `DeveloperApplication`, `DeveloperFollow`, `DeveloperInstallCost`, `DeveloperPayout`, `DeveloperSupportTicket`, `DeviceToken`, `DialectGlossary`, `DisputeClaim`, `DisputeNegotiationChat`, `DisputeNegotiationSettings`, `DomainEvent`, `DynamicPricing`, `EarnAdView`, `EarnBackLedger`, `EarnBackPlan`, `EarnBoost`, `EarnedAdvertiser`, `EcosystemConfig`, `EcosystemRunLog`, `EmailMarketingFlow`, `EmailSequence`, `Expense`, `ExtensionReward`, `FeatureMockup`, `FeaturePmfSnapshot`, `FeatureUsageEvent`, `FeatureVoteSurvey`, `FeedbackSurveyResponse`, `FlaggedResponse`, `FlexPayPlan`, `ForumPost`, `FoundingAdvertiser`, `FoundingDataSignal`, `FraudReport`, `FriendRequest`, `FunnelBenchmark`, `FunnelEmailLog`, `FunnelJourney`, `Game`, `GameEngagement`, `GameGuide`, `GameRating`, `GameReview`, `GameSession`, `GameVote`, `GameVoteSurvey`, `GeneratedImage`, `GiftBoost`, `GiftCardRedemption`, `GiftCardStock`, `GiftTransaction`, `GlobalPrestige`, `GlobalSettings`, `GoodsAdvance`, `GroupContribution`, `GroupGoal`, `GroupGoalReward`, `GroupMessage`, `GroupSession`, `GroupSpendRequest`, `GrowthHeatmapData`, `GrowthPlan`, `Guild`, `GuildChallenge`, `GuildMember`, `GuildReward`, `HeadToHeadContest`, `Household`, `IAPAdvertisingCredit`, `IdempotencyKey`, `InAppPurchase`, `InfluencerDeal`, `IntegrationConfig`, `InteractionEvent`, `ItemSavingsGoal`, `KYCResponse`, `KYCRewardGrant`, `KycSurveyConfig`, `LanguageReference`, `Layaway`, `LeaderboardArchive`, `LeaderboardEntry`, `LiveAssignment`, `LiveEvent`, `LiveExperiment`, `LiveMetricEvent`, `LivestreamFeature`, `LocalizationString`, `LockoutSession`, `LoyaltyLedger`, `MLMNode`, `MaintenanceReport`, `MarketResearchReport`, `MarketTrendReport`, `MarketingAsset`, `MarketingCampaign`, `MarketplaceListing`, `MarketplaceStore`, `MockupVoteSurvey`, `MoneyLedgerEntry`, `MoneyTransfer`, `Notification`, `OnboardingProgress`, `OpsShift`, `OptimizationExperiment`, `OptimizationOutcome`, `OptimizationRecommendation`, `OptimizationSignal`, `Order`, `OverheadReport`, `PPCAbTest`, `PPCSession`, `PPCSurvey`, `PPCSurveyResponse`, `PPCTransaction`, `PPCUserTier`, `PartnerTier`, `PayPalAccount`, `Payout`, `PayoutPreference`, `PayoutRecommendation`, `PayoutRequest`, `PendingProduct`, `PerformanceAlert`, `PersonalizedOffer`, `PlatformCredit`, `PmfAgentPlan`, `PointsBoostLedger`, `PremiumAdFreeDay`, `PremiumBoostFunding`, `PremiumBoostGrant`, `PremiumEnrollClaim`, `PremiumFinancePlan`, `PremiumMembership`, `PremiumPPCCharge`, `PremiumPPCMembership`, `PremiumPlan`, `PricingFeedback`, `Product`, `ProductAnalyticsReport`, `ProductStat`, `ProductWebsiteAnalytics`, `ProductWishlistItem`, `PromoCode`, `ProviderUsage`, `PushSubscription`, `ReconciliationReport`, `RedemptionRecord`, `Referral`, `ReferralAchievement`, `ReferralAnomalyFlag`, `ReferralAutomation`, `ReferralBadge`, `ReferralCampaign`, `ReferralContentAsset`, `ReferralContest`, `ReferralEmailLog`, `ReferralEmailSequence`, `ReferralFollowUp`, `ReferralInviteBatch`, `ReferralJackpot`, `ReferralLifetimeValue`, `ReferralMilestone`, `ReferralPayout`, `ReferralPostEntry`, `ReferralPrediction`, `ReferralRiskFlag`, `ReferralSquad`, `ReferralTier`, `RespondentProfile`, `RespondentTrustScore`, `RetentionCampaign`, `RetentionRisk`, `RevenueEvent`, `RevenueLever`, `RevenueProduct`, `RewardPerk`, `RewardTier`, `SaveToGetGoal`, `SavedSurveySearch`, `ScreenOutEvent`, `Season`, `SeasonRank`, `SellerMarketplaceListing`, `SessionCaptureFrame`, `SessionClose`, `SessionRating`, `SessionRecording`, `SharedWalletGroup`, `SimulcastJob`, `SiteCashGift`, `SiteCashTopoff`, `SmartNotificationRule`, `SocialConnection`, `SocialMediaConnection`, `SocialMediaPost`, `SourcedOrder`, `SponsoredContent`, `SponsoredListing`, `SponsoredPlacement`, `SquadActivityFeed`, `SquadMember`, `Streak`, `StreamSession`, `StreamerSubscription`, `StreamerTip`, `Subscription`, `Supplier`, `SupportTicket`, `SupportTicketDossier`, `Survey`, `SurveyABTest`, `SurveyCollabSession`, `SurveyDispute`, `SurveyEvidence`, `SurveyHeatmapData`, `SurveyHonestyAnalysis`, `SurveyMarketplaceListing`, `SurveyProfile`, `SurveyRecommendation`, `SurveySchedule`, `SurveySignal`, `SurveyTemplate`, `TaxProfile`, `Tenant`, `Tier1FinancedPlan`, `Tier1SelfPacedPlan`, `Tier2ScalingPlan`, `TieredMembership`, `Tournament`, `TournamentAIInsight`, `TournamentChallenge`, `TournamentLeaderboard`, `TournamentMatch`, `TournamentParticipant`, `Transaction`, `TransferRequest`, `TutorialProgress`, `UXFinding`, `UXHeatmapSnapshot`, `UXSessionRecording`, `User`, `UserAIProfile`, `UserAchievement`, `UserAchievementBadge`, `UserActivity`, `UserBadge`, `UserCosmetic`, `UserGroup`, `UserInventory`, `UserJourneyEvent`, `UserLevel`, `UserPlatformStats`, `UserProductProfile`, `UserRecommendation`, `UserSubscription`, `UserSuggestion`, `UserVariantState`, `VerifiedSurveyMedia`, `VirtualCurrency`, `WeeklyEvent`, `WeeklyReferralCampaign`, `WhiteLabelLicense`, `WhiteLabelPartner`, `WishlistShareReferral`, `WithdrawalRequest`, `YouTubeEmbedAnalytics`, `YouTubeVideoSession`

---

## 6. Configurable capabilities (feature/capability flags)

The platform exposes ~1,200 admin-configurable capability flags — every one a switch or tunable that governs a feature's behavior, cost, or compliance gate. They are organized into these 50 categories:

- **Scale & Platform** — 106 flags
- **Surveys** — 91 flags
- **Scale** — 88 flags
- **AI & Agents** — 82 flags
- **Founding Advertiser** — 69 flags
- **Premium PPC** — 50 flags
- **AI Creative Suite** — 44 flags
- **Earned Advertiser** — 35 flags
- **Economy & Payouts** — 31 flags
- **Tier 2 Scaling** — 29 flags
- **AI Video Engine** — 29 flags
- **Revenue** — 25 flags
- **Referrals / Affiliate** — 23 flags
- **Loyalty & Rewards** — 23 flags
- **Advertiser Billing** — 20 flags
- **AI Funnel** — 19 flags
- **Revenue Levers (gated)** — 17 flags
- **Marketplace** — 17 flags
- **Social Amplification** — 16 flags
- **Automation** — 14 flags
- **Compliance & Legal** — 11 flags
- **Flexible Payment (credit — OFF)** — 11 flags
- **Points Boost** — 10 flags
- **Growth** — 9 flags
- **Tier 1 Financed (credit — OFF)** — 9 flags
- **Product Stats** — 9 flags
- **Tier Progression** — 9 flags
- **Ad Branding** — 9 flags
- **Video Autopilot** — 9 flags
- **Goods Advance (credit — OFF)** — 8 flags
- **Games & Contests** — 6 flags
- **Concept Polling** — 6 flags
- **Tier 1 Self-Paced (no-debt)** — 5 flags
- **AI Survey Suite** — 5 flags
- **Revenue Levers (counsel)** — 4 flags
- **Store & Fulfillment** — 4 flags
- **Referrals** — 4 flags
- **Messaging & Marketing** — 4 flags
- **Content & UI** — 4 flags
- **Tier 3 Unlimited** — 4 flags
- **Security** — 4 flags
- **Gamification** — 3 flags
- **Gift & Boost** — 3 flags
- **Premium Gift Boost** — 3 flags
- **Membership** — 2 flags
- **Sourcing** — 2 flags
- **Save-to-Get** — 2 flags
- **Earnings What-If** — 2 flags
- **Earnings Set-Aside** — 1 flags
- **SMS Opt-In** — 1 flags

*(The complete flag list with defaults and help text is in `ADMIN-SETTINGS-README.md` / `backend/sdk/settings.ts`.)*
