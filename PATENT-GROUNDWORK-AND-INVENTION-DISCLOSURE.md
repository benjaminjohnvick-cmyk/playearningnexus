# Invention Disclosure & Patent Groundwork — Get Goods Gratis (Free) / GamerGain / PlayEarning Nexus

**Prepared for patent counsel.** This document is the technical groundwork for evaluating and filing patent
protection on the platform's website, mobile applications, and back-end software. It describes the system's
architecture and its novel features and methods so counsel can assess **patent-eligibility (35 U.S.C. §101),
novelty (§102), and non-obviousness (§103)**, identify the strongest candidate claims, and decide the filing
strategy (utility application(s), possibly a provisional to secure a priority date, plus design patents on
distinctive UI, and separate trademark/copyright coverage).

> **Not legal advice.** This is an inventor's technical disclosure prepared to brief an attorney. It does not
> assess patentability itself. Some elements described are business methods or use third-party AI models; counsel
> should evaluate which combinations are patent-eligible and which are best protected as trade secrets or by
> copyright instead. Nothing here should be publicly disclosed, sold, or offered for sale before counsel advises
> on the one-year U.S. statutory bar and on foreign absolute-novelty requirements.

---

## 0. Inventor, ownership, and priority

- **Inventor / owner:** Ben Vick (benjaminjohnvick@gmail.com). Sole developer of the platform to date.
- **Work product:** All source code, specifications, and design documents in this packet and in the GitHub
  repository `benjaminjohnvick-cmyk/playearningnexus` were authored for this project.
- **Priority urgency:** Because the platform is approaching launch, counsel should advise **immediately** on
  filing a provisional application to establish a priority date **before** any public launch, demo, investor
  disclosure, or app-store submission, each of which can start or trigger statutory bars.
- **Records available for counsel:** dated Git commit history (conception + reduction-to-practice evidence),
  the full specification set in this Lawyer Packet, and the running code.

---

## 1. Field of the invention

Computer-implemented systems and methods for an **integrated, closed-loop "play/earn-to-shop" digital
marketplace** that unifies (a) a consumer rewards economy funded by advertisers rather than by consumer markup,
(b) an artificial-intelligence advertising engine that generates, tests, and optimizes creative across owned and
social surfaces, and (c) a platform-wide **graduated-autonomy automation framework** by which AI progressively
and safely takes over operational decisions under measured trust, with permanent human/compliance gates on
money, identity, and legal actions. Implemented as a responsive website, native/wrapped mobile applications, and
a serverless back end of ~890 functions and ~180 subsystem modules.

---

## 2. Background and problem addressed

Existing "get-paid-to," survey, loyalty, and affiliate platforms suffer from recurring problems: (i) they fund
rewards from consumer markups or opaque data resale; (ii) advertising creative is produced and optimized
manually and slowly; (iii) automation is all-or-nothing, so operators either keep humans in every loop (costly,
slow) or hand full control to AI with inadequate guardrails (risky, non-compliant); (iv) "earning" claims and
influencer/referral incentives create disclosure, pyramid-scheme, money-transmission, and tax-reporting exposure
that is bolted on after the fact rather than enforced by the software; and (v) operating costs (AI inference,
media rendering, storage) scale unfavorably. The disclosed platform addresses each with specific technical
mechanisms described below, several of which are believed novel individually and, as an integrated system,
non-obvious in combination.

---

## 3. Summary of the invention

The platform is a single system combining the following cooperating subsystems, each described in Section 5:

1. A **closed-loop rewards economy** using non-cashable, closed-loop store credit ("Site Cash") and a
   "**earn-to-unlock**" progression that lets users unlock premium capabilities through platform activity rather
   than cash, with an **earn-parity** mechanism keeping earned and paid paths equivalent.
2. An **advertiser-funded revenue model** with a **delivered-advertising-value guarantee** that measures and
   substantiates value delivered (impressions × CPM, measured ROI) while never promising revenue/ROI — enforced
   by an automated compliance screen.
3. An **AI social-video generation and optimization engine** that defines a very large combinatorial creative
   search space, samples and scores candidate concepts, tests survivors on platform-owned surfaces, measures
   quantifiable response, and tailors output toward best responders — grounded in live trend/current-event data.
4. A **concept-polling loop** (head-to-head and MaxDiff) that turns AI-generated concepts into user polls whose
   results feed the video engine's playbook.
5. A **video autopilot** running the above end-to-end with a human approval gate that **self-graduates** to full
   autonomy as trust is earned.
6. A generalized **Autonomy Kernel**: a decision-automation framework that classifies every automatable decision
   into a "domain," graduates each domain **manual → earned → full** based on measured trust signals (approved
   runs, human-agreement rate, data depth), enforces **permanent human/compliance gates** on money/identity/legal
   domains, and provides a global kill switch and budget caps.
7. An **automatic feedback auto-collection** system that harvests implicit signals from every customer-facing
   surface (rather than requiring users to answer questions) and routes them into the learning loops.
8. An **unbiased choice presentation** mechanism ("Fair Choice") that offers users a selection among current-event
   topics/ads **without favoring any option**, so selection data is unbiased.
9. An **AI creative suite with a self-learning creative playbook** that tags each creative across attribute axes
   and learns which attribute values win from measured outcomes, then conditions future generation on the winners.
10. A **paid-endorser social program** in which opted-in members' own social accounts post AI-personalized,
    disclosure-enforced ads; rewards are a share of **measured conversion value**; posting is **triple-gated** by
    the Autonomy Kernel; and the copy **self-improves** on conversion data.
11. A **two-tier referral system** paying closed-loop credit with a **clawback-gated** advertiser bonus released
    only after a referred advertiser's payment clears and a hold window elapses.
12. A **one-click cost-floor optimizer** that pulls every configuration lever to move inference, media, voice, and
    storage onto free/cheaper providers with automatic fallback, keeping every feature enabled.
13. A **compliance-as-code layer**: jurisdiction/age gating, disclosure enforcement at content generation,
    closed-loop money primitives with an auditable ledger, KYC and 1099 tax pipeline, and reversible feature flags.

---

## 4. System architecture (implementation)

- **Front end:** responsive React/Vite single-page web application (~230 route-level pages) with a
  configuration-driven page router; packaged as mobile apps via a wrapper/Fastlane pipeline. Distinctive screens
  (e.g., the Automation Command Center, AI Video Studio, Fair Topic Picker) are candidates for **design patents**.
- **Back end:** ~890 serverless functions (Deno runtime) dispatched through a manifest, plus ~180 typed subsystem
  modules ("sdk"). An in-process function-invocation bus lets functions compose without HTTP.
- **Data:** a document-style store (JSONB rows) with generated relational schema and expression indexes;
  append-only **money ledger** and **consent ledger**; optimization-signal and learning-memory stores.
- **Scheduling:** a cron-style scheduler drives recurring autonomous jobs (the `auto*` function family).
- **AI providers:** provider-abstracted LLM/image/TTS/STT with runtime selection and automatic fallback (e.g.,
  OpenAI-compatible calls routed to free Llama via Groq; images to free FLUX via Cloudflare).
- **Money rails:** closed-loop Site Cash/points as the default settlement unit; external payout rails (PayPal,
  Venmo, Cash App) behind permanent gates, KYC, and a 1099 export pipeline.

---

## 5. Detailed description of novel subsystems and methods

Each subsection states **what it does**, **the mechanism**, and **why it is believed novel/non-obvious** for
counsel to evaluate. Representative code modules are named for the attorney's technical reviewer.

### 5.1 Closed-loop earn-to-unlock economy with earn parity
**What.** Users earn a non-cashable, closed-loop credit ("Site Cash"/points) through advertiser-funded activity
(surveys, games, tasks) and can **unlock premium tiers/capabilities by earning rather than paying**, at parity
with paying users. **Mechanism.** A settlement unit that is never withdrawable is used for internal rewards and
purchase offset (auto-applied at checkout within a per-transaction cap); an "earn-to-unlock" progression tracks
qualifying activity to grant capabilities; an **earn-parity** module keeps the earned path equivalent in value
to the paid path; funding is drawn from an advertiser pool + breakage, reserved by a growth/solvency engine.
Modules: `site-model.ts`, `site-cash-apply.ts`, `earn-rate.ts`, `earn-parity` spec, `earn-cap.ts`,
`funding-pool.ts`, `balance.ts`, `ledger.ts`. **Novelty for counsel.** The specific combination of non-cashable
closed-loop settlement + earn-to-unlock capability grants + enforced earned/paid parity + advertiser-pool funding
with automated solvency reservation.

### 5.2 Advertiser-funded model with a delivered-value guarantee and automated claim compliance
**What.** Advertisers fund the economy; the platform **measures and substantiates advertising value delivered**
(estimated impressions × CPM and measured ROI/ROAS) and backs it with a **make-good** guarantee, while a
compliance screen **blocks any promised-revenue/ROI/earnings claim**. **Mechanism.** A full-value-guarantee
calculator, delivery-guarantee/make-good engine, advertiser metrics that aggregate delivered value, and a
copy-screening function that rejects prohibited claims at generation time. Modules: `full-value-guarantee.ts`,
`delivery-guarantee.ts`, `advertiser-metrics.ts`, `revenue-stack.ts`, `disclosure.ts`, creative screen in
`creative-suite.ts`. **Novelty.** Measuring/guaranteeing *delivery value* (not results) with software-enforced
claim screening as an integrated advertising-settlement method.

### 5.3 AI social-video generation & optimization over a combinatorial search space with owned-surface testing
**What.** Defines a very large space of possible short-video concepts (composed from independent creative axes),
**samples and predictively scores** candidates, **renders only survivors**, tests them on **platform-owned
surfaces**, ingests **quantifiable** engagement metrics, and **tailors** subsequent generations toward the
attributes of best responders — grounded in **live trend/current-event** signals. **Mechanism.** A concept
sampler over enumerated axes; a predictive scorer; a phased pipeline (concepts → poll/score → render winners →
measure → learn); a trend-refresh step that pulls current events; metric ingestion that updates a per-attribute
playbook. Modules: `video-engine.ts`, functions `aiVideoEngineGenerate/…RefreshTrends/…RenderWinners/
…IngestMetrics/…Learn/…Status`. **Novelty.** The end-to-end closed loop of large-space sampling + predictive
pre-scoring + render-only-winners + owned-surface measurement + trend-grounded self-tailoring.

### 5.4 Concept-polling loop feeding the creative engine
**What.** Converts AI-generated concepts into **head-to-head and MaxDiff** user polls; poll results feed the
video/creative playbook so the platform learns which concepts resonate **before** spending on production.
**Mechanism.** Poll construction from a concept pool, matchup generation, vote capture, and a learn step that
writes rankings back to the shared playbook. Modules: `concept-polling.ts`, functions `aiConceptPollCreate/
…Next/…Vote/…Results/…Learn`. **Novelty.** Using structured preference elicitation (MaxDiff/pairwise) as an
upstream, low-cost signal source that directly conditions generative-ad production.

### 5.5 Video autopilot with self-graduating human-in-the-loop approval
**What.** Runs 5.3–5.4 end-to-end automatically with a pre-render human approval gate that **removes itself** as
the system earns trust. **Mechanism.** A daily/manual tick pipeline; an approval record per run; a graduation
check (Section 5.6) that flips the gate from required to automatic once trust thresholds are met. Modules:
`video-autopilot.ts`, functions `aiVideoAutopilotStart/…Tick/…Approve/…Status`. **Novelty.** Approval gate whose
*necessity* is itself governed by measured agreement between AI and human reviewers.

### 5.6 The Autonomy Kernel — graduated-trust decision automation with permanent compliance gates
**What.** A **general framework** (not specific to video) that governs how AI takes over any operational
decision. Every automatable decision is a **domain** classified as `auto_ok` (may graduate) or `permanent_gate`
(never automated — money, identity, legal, disputes, risk). Each `auto_ok` domain graduates **manual → earned →
full** based on measured **trust signals**: number of approved runs, human-agreement rate, and data depth,
compared against thresholds. A **global kill switch** and **budget caps** always apply. **Mechanism.** A domain
registry; a pure policy resolver; a trust computation over decision history; a decision function returning
auto/gate with per-bar progress. Modules: `autonomy-kernel.ts`, functions `autonomyDecide/…Approve/…SetMode/
…Status`; surfaced in an Automation Command Center UI. **Novelty (a strong candidate).** A reusable
trust-graduation controller that (i) unifies heterogeneous decisions under one domain model, (ii) advances
autonomy per-domain from measured human-agreement rather than fixed rules, and (iii) hard-partitions
money/identity/legal domains as permanently human-gated — an auditable governance method for progressive AI
autonomy.

### 5.7 Automatic feedback auto-collection from customer-facing surfaces
**What.** Instead of asking users to answer questions, the system **passively/implicitly harvests** feedback
signals from **every** customer-facing surface and routes them into the same learning loops that human feedback
would feed. **Mechanism.** A surface→domain mapping; an auto-collect job that derives structured signals from
interactions; unification with explicit feedback into one feedback store. Modules: `feedback.ts`, functions
`feedbackAutoCollect/…Submit/…Status`. **Novelty.** Treating implicit interaction across all surfaces as
first-class feedback that drives the autonomy/creative learning loops.

### 5.8 Unbiased "Fair Choice" topic/ad presentation
**What.** Presents users a choice among current-event topics/ads **engineered not to favor any option** (order,
prominence, and framing neutralized), so the **selection data is unbiased** and can be collected passively.
**Mechanism.** A fair-presentation module that randomizes/normalizes option exposure and records choices as
unbiased signals. Module: `fair-choice.ts`, functions `trendChoiceVote/…Next/…Results`; UI `FairTopicPicker`.
**Novelty.** A bias-controlled choice-elicitation UI whose explicit purpose is unbiased passive data collection
feeding ad/creative optimization.

### 5.9 AI creative suite with a self-learning creative playbook
**What.** Generates ad creative, **tags each creative on attribute axes** (format, hook, tone, length, CTA style,
visual style, emoji, urgency, audience), records measured outcomes, and builds a **playbook** ranking attribute
values by a sample-smoothed score; future generations are **conditioned on the winners** (per advertiser and
per platform). **Mechanism.** Attribute tagging at generation; outcome recording into an optimization-signal
store; a playbook builder with a smoothed scoring function; prompt-conditioning on top attributes. Modules:
`creative-suite.ts`, `ad-learning.ts`, `optimizer.ts`. **Novelty.** A per-attribute, sample-smoothed
learn-and-condition loop that is **shared across ad channels** (see 5.10).

### 5.10 Paid-endorser social program: AI personalization, enforced disclosure, triple-gated auto-posting, and self-learning
**What.** Opted-in members connect their own social accounts; the platform **personalizes an advertiser's
approved creative** for each member/platform (pinned to approved claims, **no income claims**), **enforces the
`#ad` disclosure so it cannot be removed**, posts as a **human-approved draft by default** and **auto-posts only
when triple-gated** (master flag + Autonomy-Kernel earned trust on the "social" domain + kill-switch off),
rewards a **share of measured conversion value** (not per-post), and **self-improves** by feeding each conversion
into the shared creative playbook (5.9) per platform. **Mechanism.** Eligibility/consent gate; personalization
prompt builder with hard claim/disclosure rules; disclosure enforcer; post-mode decision using the Autonomy
Kernel; conversion→reward hooks; conversion→playbook learning hook. Modules: `social-endorser-engine.ts`,
`endorser-rewards.ts`, `social-amplification.ts`, functions `endorserPersonalizePost/endorserConversionRecord/
endorserPostConversionHook/endorserRewardSweep`. **Novelty.** Combining enforced-at-generation disclosure +
approved-claim-pinned personalization + autonomy-graduated auto-posting + measured-conversion rewards + shared
self-learning into one endorsement-distribution method. **Status:** built, **disabled by default pending
counsel**; nothing posts or pays until enabled.

### 5.11 Two-tier referral with clawback-gated advertiser bonus (closed-loop)
**What.** A single-tier referral (no downline) paying **$5** closed-loop credit for an active referred **user**
and **$2,000 per referred paying advertiser, on each advertiser tier**, where the advertiser bonus is released
**only after the referred advertiser's payment clears and a clawback/hold window elapses** and is voided on
refund/chargeback/self-referral/failed-KYC. **Mechanism.** Amount/eligibility core; a record hook that stages a
pending bonus (credits nothing); a gated sweep that pays and writes a reportable ledger entry; auto-staging on
the real referral conversion. Modules: `referral-tiers.ts`, functions `referralBonusRecord/referralBonusSweep`,
`autoReferralConversionHandler`. **Novelty.** A settlement-timing method that funds a large referral incentive
only from *cleared, retained* revenue, with automated clawback, defeating referral fraud/farming. **Status:**
disabled by default pending counsel.

### 5.12 One-click cost-floor optimizer with provider offload and automatic fallback
**What.** A single action pulls **every** configuration lever to move all AI/media/voice/storage onto **free or
cheaper** providers **while keeping every feature enabled**, and reports remaining "free unlocks." **Mechanism.**
A profile function that sets provider/model/caching/spend-cap settings atomically; a provider-abstraction layer
with runtime selection and **automatic fallback** to a paid provider on error/rate-limit. Modules:
`costFloorProfile`, `agents-runtime/agent-runtime.ts`, `providers.ts`, `provider-advisor.ts`, `image-gen.ts`,
`tts.ts`, `transcription.ts`. **Novelty.** A one-action, feature-preserving cost-floor controller spanning the
whole stack with graceful degradation.

### 5.13 Compliance-as-code enforcement layer
**What.** Legal posture is **enforced by software**, not policy alone: jurisdiction + 18+ age gating at the point
of action; disclosure enforcement at content generation; closed-loop money primitives with an **append-only
auditable ledger**; a **consent ledger**; KYC and a filing-ready **1099** export; and reversible feature flags so
sensitive features ship **off** behind named switches. Modules: `jurisdiction.ts`, `disclosure.ts`, `consent-
ledger.ts`, `kyc.ts`, `tax.ts` (+ `tax1099Export`), `feature-flags.ts`, `internal-guard.ts`. **Novelty.** An
integrated "guardrails-in-code" layer binding money, identity, disclosure, and jurisdiction controls to the
same switches that govern autonomy (5.6).

### 5.14 Supporting subsystems (breadth of the software; individually likely not novel but part of the whole system)
Surveys & evidence (`survey-suite.ts`, `verified-survey.ts`, `survey-evidence.ts`, `answer-match.ts`);
gamification (streaks, quests, tournaments, leaderboards, guilds, seasons, prestige); marketplace/catalog &
one-click member storefronts (`catalog.ts`, `marketplace-fee.ts`, `seller-activation.ts`, `dropship.ts`,
`product-feeds.ts`); advertiser tiers & financing (`tier1-financed.ts`, `tier2-scaling.ts`, `tier3-unlimited.ts`,
`premium-finance.ts`, `flexpay.ts`, `layaway.ts`, `save-to-get.ts`); payouts & fraud (`payout-policy.ts`,
`payout-reservation.ts`, fraud scorers); household/teen accounts (`household.ts`); AI support/dispute automation;
localization/i18n; white-label/tenant (`tenant.ts`). These establish the **full scope** of the software for
copyright and for the "system" claims that incorporate the novel subsystems above.

---

## 6. Candidate inventions / claim seeds (for counsel to prioritize)

The following are the strongest candidates to claim as computer-implemented **methods and systems**. Counsel to
assess §101 eligibility (frame as specific technical implementations, not abstract ideas) and prior art:

1. **Graduated-autonomy decision controller** with per-domain trust graduation (manual→earned→full) from measured
   human-agreement signals, permanent money/identity/legal gates, kill switch, and budget caps. (§5.6) — *lead
   candidate.*
2. **Trend-grounded generative-video optimization** over a combinatorial concept space with predictive
   pre-scoring, render-only-winners, and owned-surface measurement feeding self-tailoring. (§5.3)
3. **Preference-poll-conditioned generative advertising** (MaxDiff/pairwise concept polling feeding creative
   generation). (§5.4)
4. **Enforced-disclosure, approved-claim-pinned endorsement distribution** with autonomy-graduated auto-posting
   and measured-conversion rewards. (§5.10)
5. **Shared self-learning creative playbook** with per-attribute sample-smoothed scoring conditioning generation
   across owned and endorser channels. (§5.9 + §5.10)
6. **Automatic multi-surface feedback auto-collection** driving autonomy/creative learning. (§5.7)
7. **Bias-controlled choice elicitation** for unbiased passive ad/topic preference data. (§5.8)
8. **Clawback-gated referral settlement** funding a large incentive only from cleared, retained revenue. (§5.11)
9. **Closed-loop earn-to-unlock economy with enforced earned/paid parity** and automated solvency reservation.
   (§5.1)
10. **Delivered-advertising-value guarantee with software-enforced claim screening.** (§5.2)
11. **Whole-stack one-click cost-floor controller** with feature-preserving provider offload and automatic
    fallback. (§5.12)
12. **Compliance-as-code layer** binding jurisdiction/age/disclosure/money/consent controls to the autonomy
    switches. (§5.13)

Several of the above are strongest **in combination** (e.g., 1+4+5 as an "autonomous, compliant, self-improving
advertising distribution system"); counsel may prefer one or two broad system claims plus dependent method
claims.

---

## 7. Distinctions over likely prior art (for the attorney's search)

- vs. survey/GPT-rewards apps: closed-loop non-cashable settlement + earn-to-unlock parity + advertiser-pool
  solvency reservation, rather than cash-out from data resale.
- vs. ad-optimization/AB tools: pre-production preference polling + predictive pre-scoring + render-only-winners
  + trend grounding as one loop, plus a **shared** cross-channel attribute playbook.
- vs. RPA / workflow automation: autonomy that **graduates from measured human-agreement per domain** with
  permanent compliance gates, not static rules or blanket AI control.
- vs. influencer platforms: disclosure **enforced at generation** and unremovable, rewards tied to **measured
  conversion**, and posting **gated by earned autonomy trust**.
- vs. MLM/referral software: single-tier, **clawback-gated** settlement from cleared revenue; explicitly not a
  downline.

---

## 8. What counsel is asked to do

1. Advise on and, if appropriate, **file a provisional** to secure priority **before launch/disclosure**.
2. Run prior-art searches on the Section 6 candidates and select the claims with the best eligibility/novelty.
3. Advise which elements to protect as **trade secret** (e.g., exact scoring formulas, thresholds) vs. patent.
4. Coordinate **design patents** on distinctive UI screens and **copyright** registration of the codebase, and
   confirm the separate **trademark** filings (brand names/logo) already contemplated in the packet.
5. Confirm inventorship/ownership and any assignment paperwork needed (contractors, if later engaged).

---

## Appendix A — Subsystem module inventory (~180 modules)

The back-end `sdk` modules are the authoritative subsystem list; representative modules are named in Section 5.
The complete set is in `06 - Code Backup/backend/sdk/` and includes (non-exhaustive): autonomy-kernel,
video-engine, video-autopilot, concept-polling, creative-suite, ad-learning, optimizer, fair-choice, feedback,
social-endorser-engine, endorser-rewards, social-amplification, referral-tiers, referral-rewards, referral-model,
site-model, site-cash-apply, earn-rate, earn-parity, earn-cap, full-value-guarantee, delivery-guarantee,
advertiser-metrics, revenue-stack, jurisdiction, disclosure, consent-ledger, kyc, tax, feature-flags, ledger,
balance, providers, provider-advisor, image-gen, tts, transcription, survey-suite, verified-survey,
survey-evidence, catalog, marketplace-fee, seller-activation, tier1-financed, tier2-scaling, tier3-unlimited,
premium-finance, flexpay, household, tenant, and others.

## Appendix B — Application surface inventory (~230 pages, ~890 functions)

The front end exposes ~230 route-level pages (see `06 - Code Backup/src/pages/`); the back end exposes ~890
serverless functions registered in `06 - Code Backup/backend/functions/_manifest.json`. Distinctive UI screens
for possible design-patent coverage include the Automation Command Center, AI Video Studio, Fair Topic Picker,
AI Agents Command Center, and the Setup Wizard. The `auto*` function family (~250 functions) implements the
scheduled autonomous operations governed by the Autonomy Kernel.

---

*Prepared as inventor's technical groundwork for patent counsel. Confidential — do not disclose publicly before
counsel advises on statutory bars.*
