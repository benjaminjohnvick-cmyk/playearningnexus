# PROVISIONAL PATENT APPLICATION (DRAFT FOR COUNSEL)

**Title of Invention:** Integrated Closed-Loop Earn-to-Shop Marketplace with Graduated-Autonomy AI Automation and an Operator-Owned, Accuracy-Gated Custom AI Model Across Web and Mobile Surfaces

---

> **⚠️ DRAFT — NOT LEGAL ADVICE. NOT YET FILED.** This is an inventor's draft of a U.S. provisional patent
> application specification, assembled from the project's technical disclosures for a registered patent attorney
> to review, tighten, and file. It has **not** been reviewed for patentability (35 U.S.C. §§101/102/103),
> enablement, or written-description sufficiency. Do not rely on it as filed protection. **Section 13 ("What
> counsel must complete") lists the remaining work only a patent attorney should do.** Nothing herein should be
> publicly disclosed, demonstrated, sold, or offered for sale before counsel advises on the U.S. one-year
> statutory bar and on foreign absolute-novelty requirements. A provisional application is **not examined and is
> never "granted"**; it secures a priority date for 12 months, within which one or more non-provisional
> applications claiming priority to it must be filed.

---

## 0. Applicant, inventorship, and cross-reference (counsel to finalize)

- **Named inventor (sole, to date):** Ben Vick — benjaminjohnvick@gmail.com.
- **Applicant / owner:** [Counsel to confirm — individual vs. an assignee entity (e.g., an LLC); record any
  assignment.]
- **Priority claim:** This is an original provisional; no earlier application is claimed. [If any earlier
  provisional exists, counsel to insert the cross-reference under 35 U.S.C. §119(e).]
- **Evidence of conception / reduction to practice:** dated Git commit history of repository
  `benjaminjohnvick-cmyk/playearningnexus`; the full specification set in the Lawyer Packet; running code.
- **Related disclosures incorporated by reference:** `PATENT-GROUNDWORK-AND-INVENTION-DISCLOSURE.md`,
  `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md`, `CUSTOM-AI-MODEL-DESIGN-AND-ROADMAP.md`,
  `WEBSITE-AND-APP-LOAD-SPEED.md`, `EARN-WHILE-LOADING-SURVEY.md`.

---

## 1. Technical field

Computer-implemented systems and methods for an integrated, closed-loop "earn-to-shop" digital marketplace
operating across a responsive website and companion mobile applications, comprising: a consumer rewards economy
funded by advertisers rather than by consumer markup; an artificial-intelligence advertising engine that
generates, tests, and optimizes creative across owned and social surfaces; a platform-wide graduated-autonomy
automation framework under which AI progressively assumes operational decisions subject to measured trust and
permanent human/compliance gates on money, identity, and legal actions; and an operator-owned custom AI model,
trained on first-party operational data, that is autonomously promoted to serve platform decisions only when its
output accuracy exceeds an incumbent model on a per-function and aggregate basis.

## 2. Background

Existing get-paid-to, survey, loyalty, affiliate, and e-commerce platforms exhibit recurring technical and
operational problems: rewards funded by consumer markups or opaque data resale; advertising creative produced and
optimized manually and slowly; automation that is all-or-nothing (humans in every loop, or unguarded AI control);
earning/referral/endorsement incentives that create disclosure, pyramid-scheme, money-transmission, and
tax-reporting exposure bolted on after the fact rather than enforced by software; operating costs (AI inference,
media rendering, storage) that scale unfavorably; and model-deployment tooling that selects or swaps machine-
learning models on a single global metric or traffic split, without per-function safety gating or binding the
swap to compliance controls. The present invention addresses each with specific technical mechanisms, several
believed novel individually and non-obvious in combination.

## 3. Summary of the invention

The invention is a single integrated system of cooperating subsystems, any of which may be claimed independently
and which are also claimed in combination:

1. A **closed-loop rewards economy** using non-cashable closed-loop store credit and an **earn-to-unlock**
   progression with an **earn-parity** mechanism keeping earned and paid paths equivalent, plus automated
   solvency reservation.
2. An **advertiser-funded model with a delivered-advertising-value guarantee** that measures and substantiates
   delivered value while never promising revenue/ROI, enforced by an automated claim-compliance screen.
3. An **AI generative-creative engine** (including social video) that samples and predictively pre-scores
   candidates over a combinatorial concept space, renders only survivors, tests them on platform-owned surfaces,
   and tailors output toward measured best-responders, grounded in live trend/current-event data.
4. A **concept-polling loop** (head-to-head / MaxDiff) feeding the creative engine's playbook.
5. A **self-graduating video/creative autopilot** running the loop end-to-end behind a human approval gate that
   graduates to autonomy as trust is earned.
6. A generalized **Autonomy Kernel**: per-domain trust graduation (manual → earned → full) from measured
   human-agreement signals, with permanent money/identity/legal gates, a global kill switch, and budget caps.
7. **Automatic multi-surface feedback auto-collection** feeding the learning loops.
8. **Unbiased ("Fair Choice") choice presentation** yielding bias-controlled preference data.
9. A **self-learning creative playbook** with per-attribute, sample-smoothed scoring conditioning generation.
10. A **paid-endorser social program** with AI personalization, enforced disclosure, autonomy-gated auto-posting,
    and conversion-based rewards.
11. A **clawback-gated two-tier referral settlement** funded only from cleared, retained revenue.
12. A **whole-stack one-click cost-floor optimizer** with feature-preserving provider offload and automatic
    fallback.
13. A **compliance-as-code enforcement layer** binding jurisdiction/age/disclosure/money/consent/tax controls to
    the same switches that govern autonomy.
14. An **operator-owned custom AI model for e-commerce** trained from first-party operational data (incumbent
    labels + human approve/reject + optimizer outcomes), shadow-evaluated against an incumbent model's output
    accuracy **per function and in aggregate**, and autonomously promoted to serve **only when it exceeds the
    incumbent on every function individually and overall** (sustained), with automatic regression rollback, all
    behind permanent money/identity/legal human gates.
15. A **single operator-owned model operating an entire consumer website AND its companion mobile apps** from one
    unified cross-surface first-party corpus, with per-surface-and-function accuracy-gated switchover.
16. A **predictive "earn-while-it-loads" mechanism** that, upon predicting a load will exceed a human-perception
    latency budget, presents profiling questions and awards capped closed-loop credit until the load completes,
    while concurrently and budget-awarely preloading the application.

## 4. System architecture (implementation)

- **Front end:** responsive single-page web application (React/Vite) with a configuration-driven page router
  (~278 route-level pages), packaged as native/wrapped mobile applications (iOS/Android) sharing one code base and
  one service-worker-cached application shell.
- **Back end:** ~1,028 serverless functions (Deno runtime) dispatched via a manifest, plus ~225 typed subsystem
  modules; an in-process invocation bus composes functions without HTTP.
- **Data:** a document-style store (JSONB rows) with generated relational schema and expression indexes; an
  append-only money ledger and an append-only consent ledger; optimization-signal and learning-memory stores;
  ~369 persisted entity types.
- **Scheduling:** a cron-style scheduler drives recurring autonomous jobs.
- **AI providers:** provider-abstracted LLM/image/TTS/STT inference with runtime selection and automatic fallback;
  a single pluggable prediction interface (`serve(domain, context)`) with a backend switch selecting which model
  answers.
- **Money rails:** closed-loop store credit/points as the default settlement unit; external payout rails behind
  permanent gates, KYC, and a 1099 tax-export pipeline.

## 5. Brief description of the drawings (figures for counsel's draftsperson to render)

Provisional applications may include informal drawings; the following figures are described so a patent
draftsperson can formalize them. Each reference numeral is a placeholder for counsel to normalize.

- **FIG. 1** — System overview: web + mobile clients, serverless function bus, data stores (money ledger, consent
  ledger, optimization signals), AI provider abstraction, and the model backend switch.
- **FIG. 2** — Autonomy Kernel state machine: per-domain graduation manual → earned → full; permanent-gate
  domains; kill switch; budget caps; the trust-signal inputs (approved runs, agreement rate, data depth).
- **FIG. 3** — Closed-loop economy: earn and paid paths, earn-parity equivalence, solvency reservation, ledger.
- **FIG. 4** — Generative-creative pipeline: concept-space sampling → predictive pre-scoring → render survivors →
  owned-surface testing → measurement → playbook update; concept-polling feedback.
- **FIG. 5** — Paid-endorser flow: personalization → enforced disclosure pinning → triple-gated auto-post →
  conversion measurement → reward settlement.
- **FIG. 6** — Custom-model lifecycle: first-party example assembly → shadow prediction → per-function + aggregate
  accuracy comparison vs. incumbent → sustained-streak promotion → serving → automatic regression rollback, with
  permanent gates intercepting money/identity/legal decisions regardless of backend.
- **FIG. 7** — Cross-surface single-model deployment across web and mobile apps from one unified corpus.
- **FIG. 8** — Earn-while-loading: load-latency prediction → question presentation + capped reward → concurrent
  budget-aware full-app preload → dismissal on load completion.
- **FIG. 9** — Compliance-as-code layer binding jurisdiction/age/disclosure/money/consent/tax controls to the
  autonomy switches.
- **FIG. 10** — Whole-stack cost-floor optimizer: lever set → provider offload → automatic fallback, features
  preserved.

## 6. Detailed description

*The following incorporates, and is consistent with, the subsystem descriptions in
`PATENT-GROUNDWORK-AND-INVENTION-DISCLOSURE.md` §5.1–5.16. Each subsystem is described functionally (for breadth)
and with a representative implementation (for enablement and §101 specificity). Module names identify the
technical reviewer's reference implementation; claims are not limited to the named modules.*

### 6.1 Closed-loop earn-to-unlock economy with earn parity
A settlement unit of non-cashable, closed-loop store credit is the default medium of exchange. Users unlock
premium capabilities either by paying or by platform activity, with an **earn-parity** function maintaining
equivalence between the earned and paid paths so neither is advantaged; an automated **solvency reservation**
reserves backing for outstanding credit before it is spendable. Append-only ledger entries make balances
auditable. *Mechanism:* money primitives (`balance.ts`, append-only ledger), parity computation, reservation on
issuance. *Breadth:* claim the parity-maintained dual-path unlock + solvency reservation independent of the
specific credit unit.

### 6.2 Advertiser-funded model with delivered-value guarantee and automated claim screening
Revenue derives from advertisers, not consumer markup. A **delivered-advertising-value** computation substantiates
value delivered (e.g., impressions × conventional rate, measured engagement) while an automated screen **blocks
any claim that promises revenue/ROI**, enforcing the guarantee's "value delivered, not results promised" posture
in software. *Breadth:* claim the software-enforced separation of substantiated delivered-value from prohibited
results-promises.

### 6.3 Generative-creative optimization over a combinatorial space with owned-surface testing
A very large combinatorial creative space is **sampled and predictively pre-scored**; only predicted winners are
**rendered** (saving inference/render cost); survivors are tested on **platform-owned surfaces**; quantifiable
response is measured; generation is tailored toward best responders; and generation is **grounded in live
trend/current-event data**. *Breadth:* claim the sample → predict → render-only-winners → owned-surface-measure →
self-tailor loop, independent of medium (video/image/copy).

### 6.4 Concept-polling loop
AI-generated concepts are turned into head-to-head / MaxDiff user polls whose results condition subsequent
generation. *Breadth:* claim preference-poll-conditioned generative advertising.

### 6.5 Self-graduating creative/video autopilot
The end-to-end loop runs behind a human approval gate that **self-graduates** to autonomy on measured trust.
(Implements §6.6 for the creative domain.)

### 6.6 The Autonomy Kernel — graduated-trust decision automation with permanent compliance gates
Every automatable decision is classified into a **domain**. Each domain graduates **manual → earned → full** based
on measured trust signals (count of approved runs, human-agreement rate, data depth) against thresholds; reaching
"earned" permits auto-approval within caps. **Permanent-gate** domains (money, identity, legal, high-risk) can
**never** auto-approve regardless of trust. A **global kill switch** forces all domains to manual; **budget caps**
bound autonomous spend. *Mechanism:* `autonomy-kernel.ts` (policy math), `autonomyDecide` (records an
`AutonomyDecision`, computes trust, returns auto-approve vs. await-human). *Breadth — lead claim:* a reusable
controller that graduates per-domain autonomy from measured human-agreement while holding a fixed set of domains
permanently gated, with kill switch and caps.

### 6.7 Automatic multi-surface feedback auto-collection
Implicit signals are harvested from customer-facing surfaces (navigation, dwell, interaction, outcome) and routed
to the learning loops without requiring explicit user input. *Breadth:* claim automatic cross-surface implicit-
signal harvesting driving autonomy/creative learning.

### 6.8 Unbiased "Fair Choice" presentation
Choices (topics/ads) are presented **without favoring any option** (order/prominence controlled) so that selection
data is bias-controlled. *Breadth:* claim bias-controlled choice elicitation for passive preference data.

### 6.9 Self-learning creative playbook
Each creative is tagged across attribute axes; per-attribute win rates are learned from measured outcomes with
**sample smoothing** (shrinkage toward a prior for low-sample attributes) and condition future generation across
owned and endorser channels. *Breadth:* claim the shared, sample-smoothed, cross-channel attribute playbook.

### 6.10 Paid-endorser social program
Opted-in members' own accounts post AI-**personalized**, **disclosure-enforced** advertisements; disclosure (e.g.,
#ad) is **pinned at generation and unremovable**; posting is **gated by the Autonomy Kernel**; rewards are a share
of **measured conversion value**; copy self-improves on conversion data. *Breadth:* claim enforced-disclosure,
approved-claim-pinned endorsement distribution with autonomy-graduated auto-posting and measured-conversion
rewards.

### 6.11 Clawback-gated two-tier referral settlement
Referral incentives pay closed-loop credit; an advertiser bonus is released **only after the referred advertiser's
payment clears and a hold window elapses** (clawback-gated), funded from cleared, retained revenue. *Breadth:*
claim clawback-gated settlement from cleared revenue (single-tier; explicitly not a downline).

### 6.12 Whole-stack one-click cost-floor optimizer
A single control pulls every configuration lever to move inference/media/voice/storage onto free or cheaper
providers, **preserving every feature**, with **automatic fallback** on provider failure. *Breadth:* claim the
feature-preserving, fallback-protected whole-stack cost-floor controller.

### 6.13 Compliance-as-code enforcement layer
Jurisdiction and age gating at the point of action; disclosure enforcement at content generation; closed-loop
money primitives with an append-only auditable ledger; a consent ledger; KYC and a filing-ready 1099 export;
reversible feature flags that ship sensitive features **off** behind named switches. *Breadth:* claim the
integrated guardrails-in-code layer binding money/identity/disclosure/jurisdiction/consent/tax controls to the
same switches that govern autonomy (§6.6).

### 6.14 Operator-owned custom AI model for e-commerce with function-by-function, accuracy-gated autonomous switchover
An incumbent general model initially operates the platform and serves two roles: it **labels** the operator's
first-party data as it operates (its proposed action per e-commerce function plus the human approve/reject on it)
and it is the **accuracy benchmark**. A pipeline assembles those labels, optimizer win/loss outcomes, and
per-feature quality into **first-party, PII-minimized** `(context → label/reward)` training examples. The
operator's model runs **in shadow from day one** behind a single pluggable interface, producing a candidate for
every decision. An evaluator scores the candidate's **output accuracy against the incumbent's**, on the same human
ground truth, **both per e-commerce function (domain) AND in aggregate**. The serving backend is **automatically
promoted** to the operator's model **only when it exceeds the incumbent on EVERY function individually by a margin
AND in aggregate**, each over a minimum sample count and **sustained across consecutive evaluations**, and is
**automatically rolled back** on regression. Money/identity/legal decisions remain **permanently human-gated**
regardless of which model serves; the training-data export is gated behind a counsel-controlled switch.
*Mechanism:* `custom-model.ts` (interface + backend switch + built-in data-learner), `model-eval.ts`
(per-function + aggregate gate, auto-promote/rollback), `model-training.ts` (first-party example assembly).
*Breadth — key claim:* promotion gated on per-function **and** aggregate out-performance of an incumbent, with the
incumbent as simultaneous labeler and live benchmark while the challenger shadows, sustained-streak promotion,
automatic regression rollback, and binding to permanent compliance gates.

### 6.15 Single operator-owned model operating an entire website AND its mobile apps from one cross-surface corpus
One operator-owned model, trained on a **unified first-party corpus spanning both the website and the native
mobile apps** (same account, same closed-loop economy, same decision domains), operates the **whole end-to-end
consumer experience** across surfaces, making **consistent decisions** rather than a separate model/ruleset per
platform, under the same accuracy-gated switchover applied **per-surface-and-function**, with permanent gates on
every surface. *Breadth:* claim the single cross-surface model operating an entire consumer property end-to-end
from one unified corpus, with cross-surface consistency as an objective.

### 6.16 Predictive earn-while-it-loads with concurrent budget-aware preload
Upon **predicting in advance** (from measured real-user latency percentiles, connection quality, and degraded-
state signals) that a load will exceed a **human-perception latency budget** (e.g., below the ~100 ms threshold at
which a response is perceived as instantaneous), the system presents generic, non-sensitive profiling questions
and awards **capped, closed-loop store credit** per answer until the load completes; **concurrently**, it
**preloads the remaining application** in a **budget-aware** manner (idle-scheduled, one unit at a time,
self-throttling on measured congestion) so subsequent navigation is instantaneous, without exceeding the
foreground latency budget. *Breadth:* claim the predict-slow-load → reward-bearing interstitial + concurrent
budget-aware preload combination.

### 6.17 Supporting subsystems (breadth of the system)
Surveys/evidence; gamification; marketplace/catalog and one-click member storefronts; advertiser tiers and
financing; payouts and fraud scoring; household/teen accounts; AI support/dispute automation; localization;
white-label/tenancy. These establish the full system scope for the combination ("system") claims.

## 7. Claims (claim seeds — broad independent claims with dependent ladders; counsel to finalize)

*Provisional applications need not contain formal claims, but these seeds document the intended scope and support
the priority date. They are drafted broad with narrower fallbacks. Counsel to re-draft for §101 eligibility,
antecedent basis, single-sentence form, and to decide which become independent applications.*

**Independent Claim A (integrated system — broadest).** A computer-implemented system comprising a web client and
a mobile-application client sharing a common application shell; a serverless back end; a closed-loop settlement
unit; and an autonomy controller that classifies operational decisions into domains and graduates each domain's
automation from manual to autonomous based on measured human-agreement signals while holding a predefined set of
money, identity, and legal domains permanently subject to human approval.
- *Dep. A1:* wherein a global control forces all domains to manual (kill switch).
- *Dep. A2:* wherein autonomous actions are bounded by configurable budget caps.
- *Dep. A3:* further comprising an append-only money ledger and an append-only consent ledger.
- *Dep. A4:* wherein rewards are funded by advertiser contributions rather than consumer markup.
- *Dep. A5:* further comprising the custom-model subsystem of Claim E.

**Independent Claim B (Autonomy Kernel — method).** A method of automating operational decisions comprising:
assigning each decision to a domain; computing, per domain, a trust measure from a count of human-approved
actions, a human-agreement rate, and a data-depth measure; permitting autonomous execution of a domain's actions
only when the trust measure satisfies domain thresholds; and unconditionally requiring human approval for a
predefined set of money/identity/legal domains irrespective of the trust measure.
- *Dep. B1–B4:* kill switch; budget caps; "clean-approval" (unmodified-approval) weighting of the agreement rate;
  per-domain threshold overrides.

**Independent Claim C (generative-creative optimization).** A method comprising defining a combinatorial creative
space; predictively pre-scoring candidate creatives; rendering only candidates exceeding a score threshold;
publishing rendered candidates to operator-owned surfaces; measuring response; and conditioning subsequent
generation on measured best-responders; optionally grounded in live external trend data.
- *Dep. C1–C4:* concept-polling conditioning; sample-smoothed per-attribute playbook; cross-channel playbook
  sharing; render-cost-avoidance limitation.

**Independent Claim D (enforced-disclosure endorsement distribution).** A method of distributing advertisements
through opted-in members' own social accounts wherein a required disclosure is pinned at content generation and
not removable, posting is gated by the autonomy controller of Claim B, and rewards are computed from measured
conversion value.

**Independent Claim E (operator-owned accuracy-gated custom model — key standalone).** A computer-implemented
method comprising: operating a platform with an incumbent model; recording, as training examples, the incumbent's
per-function proposed decisions together with human approve/reject labels; training a challenger model on said
first-party examples; executing the challenger in shadow to produce candidate decisions; measuring output accuracy
of the challenger and of the incumbent against the human labels **both per function and in aggregate**; switching a
serving backend to the challenger **only when the challenger's accuracy exceeds the incumbent's on every function
individually by at least a margin and in aggregate, sustained across a plurality of successive evaluations**;
automatically reverting the serving backend upon a subsequent regression; and executing a predefined set of
money/identity/legal decisions under mandatory human approval regardless of the serving backend.
- *Dep. E1:* wherein the incumbent model both labels the training data and serves as the live accuracy benchmark.
- *Dep. E2:* wherein a function is eligible to gate the switch only after accumulating a minimum number of
  evaluated decisions.
- *Dep. E3:* wherein training examples are PII-minimized.
- *Dep. E4:* wherein the challenger is served via a pluggable interface selectable by configuration without code
  change.
- *Dep. E5 (cross-surface):* wherein a single challenger model operates both a website and a mobile application
  from a unified cross-surface corpus, and the switching is performed per-surface-and-function.
- *Dep. E6:* wherein the training-data export is disabled behind a controlled switch.

**Independent Claim F (predictive earn-while-loading + preload).** A method comprising: predicting, from measured
latency percentiles and connection signals, that a load will exceed a perception-latency budget; responsively
presenting profiling prompts and awarding capped closed-loop credit per response until the load completes; and
concurrently preloading remaining application code in an idle-scheduled, self-throttling manner that keeps
foreground interaction latency within the budget.

**Independent Claim G (clawback-gated referral settlement).** A method of settling referral incentives in
closed-loop credit wherein a referred-advertiser bonus is released only after the advertiser's payment clears and
a hold window elapses, funded from cleared retained revenue.

**Independent Claim H (whole-stack cost-floor controller).** A method wherein a single control reconfigures
inference, media, voice, and storage providers to a lowest-cost configuration while preserving enabled features,
with automatic fallback to an alternate provider on failure.

**Independent Claim I (compliance-as-code layer).** A system binding jurisdiction gating, age gating, generation-
time disclosure enforcement, append-only money and consent ledgers, a KYC/1099 pipeline, and reversible
default-off feature flags to the same controls that govern the autonomy controller of Claim B.

*(Counsel: consider one or two broad "system" claims (A, incorporating E) plus method families B–I, and evaluate
which subjects warrant separate non-provisional filings versus dependent claims.)*

## 8. Abstract

A cross-surface (web and mobile) closed-loop "earn-to-shop" marketplace in which rewards are advertiser-funded,
AI generates and optimizes advertising creative on owned surfaces, and a graduated-autonomy controller lets AI
assume operational decisions per domain under measured trust while permanently gating money/identity/legal
decisions to human approval. An operator-owned AI model, trained on first-party operational data labeled by an
incumbent model, runs in shadow and is automatically promoted to serve — and automatically rolled back — based on
exceeding the incumbent's output accuracy on a per-function and aggregate basis across web and mobile, with
compliance controls enforced in code.

## 9. Enablement pointers (for written-description support)

The reference implementation comprises ~1,028 serverless functions, ~225 subsystem modules, ~369 persisted entity
types, and ~278 client pages, enumerated in `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md` (incorporated by
reference), providing written-description and enablement support for the claimed functions. Representative modules
are named per subsystem in Section 6.

---

## 10. Distinctions over likely prior art (to aid counsel's search)

- vs. get-paid-to/survey apps: closed-loop non-cashable settlement + earn parity + advertiser-pool solvency
  reservation, not cash-out from data resale.
- vs. ad-optimization / A-B tools: pre-production preference polling + predictive pre-scoring + render-only-winners
  + trend grounding as one loop, plus a shared cross-channel attribute playbook.
- vs. RPA / workflow automation: autonomy that graduates from measured per-domain human agreement with permanent
  compliance gates, not static rules or blanket AI control.
- vs. AutoML / champion-challenger / A-B model deployment: promotion gated on beating the incumbent **per function
  AND in aggregate** (not one global metric or a traffic-split winner); the incumbent is simultaneously labeler
  and live benchmark; promotion requires a sustained multi-evaluation streak with automatic regression rollback;
  and the autonomous swap is bound to permanent money/identity/legal human gates. Training corpus is the
  operator's own first-party, PII-minimized operational data.
- vs. influencer platforms: disclosure enforced at generation and unremovable; rewards tied to measured
  conversion; posting gated by earned autonomy.
- vs. MLM/referral software: single-tier, clawback-gated settlement from cleared revenue; not a downline.

---

## 11. Matters expressly reserved / flagged (do not treat as decided)

- Whether using an AI provider's outputs to label data for training a separate model is permitted under that
  provider's terms — a terms-of-service + privacy question (see `MODEL-TRAINING-DATA-COUNSEL-NOTE.md`).
- The games-to-retail repositioning (2026-09-09): counsel may prefer claim language framed around retail/rewards
  with games as one searchable category.
- Which elements to protect as **trade secret** rather than patent (exact thresholds, margins, scoring formulas),
  since a published patent teaches them.

---

## 12. What a provisional gives you, concretely

A filed provisional establishes a **priority date** for everything disclosed herein, permits "patent pending," is
not examined, and lasts **12 months**, within which one or more **non-provisional** applications claiming priority
must be filed or the priority is lost. Broad disclosure now is advantageous because **new matter cannot be added**
later; narrowing happens in the non-provisionals.

---

## 13. WHAT COUNSEL MUST COMPLETE — the remaining 10–20% (only a patent attorney should do this)

This draft intentionally stops short of tasks that require a registered practitioner's judgment. Counsel should:

1. **Patentability & §101 eligibility.** Assess each subject against *Alice/Mayo*; re-draft claims as specific
   technical improvements (not abstract business methods); decide which subjects are eligible at all.
2. **Prior-art search (§§102/103)** on each independent claim (especially E — model-deployment art is crowded) and
   set claim scope accordingly.
3. **Formal claim drafting.** Convert the Section 7 seeds into proper single-sentence claims with correct
   antecedent basis, one independent claim per invention family, and properly nested dependents; decide the
   broad-vs-narrow ladder depth.
4. **Filing strategy / restriction.** Decide whether to file **one** non-provisional with multiple inventions
   (and accept likely restriction requirements → divisionals) or **several** targeted non-provisionals off this
   one provisional priority date; plan the 12-month budget.
5. **Drawings.** Have a draftsperson render FIGS. 1–10 to USPTO standards and normalize reference numerals.
6. **Inventorship & ownership.** Confirm sole vs. joint inventorship; execute any assignment to an entity; verify
   no third-party/contractor IP or open-source licensing taints the claimed matter.
7. **Statutory-bar & foreign-filing timing.** Confirm no public disclosure/sale/demo has started the U.S. one-year
   clock; advise on PCT / foreign absolute-novelty before any launch; calendar the 12-month non-provisional
   deadline and any Paris Convention dates.
8. **Trade-secret carve-out.** Decide what to **remove** from the public specification (exact thresholds,
   margins, formulas) and keep as trade secret.
9. **Third-party-AI and ToS review.** Resolve the Section 11 reserved matters before claims rely on incumbent-model
   labeling.
10. **Enablement/written-description sufficiency.** Confirm the specification (plus incorporated disclosures)
    enables each claim, and add any implementation detail an examiner would require.
11. **Entity status & fees.** Determine micro/small/large entity status; file the provisional cover sheet (SB/16),
    specification, any drawings, and fee via Patent Center.
12. **Title & claim-set finalization.** Approve or revise the title and the final independent-claim selection.

---

*Prepared 2026-09-13 as an inventor's draft for patent counsel. Not legal advice; not filed; not a substitute for
a registered patent attorney's review and filing.*
