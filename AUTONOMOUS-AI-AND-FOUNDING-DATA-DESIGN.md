# Autonomous AI, Founding Data Collection & the Tier 1 Benefit Year

*Built 2026-09-05. Delivers three owner decisions: (1) the pre-revenue / founding tier collects all first-party
user data for the AI to learn from; (2) the AI model is targeted to be fully working by year-end and runs
autonomously across every non-sensitive function, auto-applying what it learns once the site is live; and
(3) Tier 1 fills with no time limit and each member's benefit year starts only after the 200,000-user
milestone. Every existing compliance guardrail is preserved. Not legal advice.*

## Decisions (locked)

1. **Founding data — full first-party, within policy.** The founding panel's activity is collected
   comprehensively as first-party product-analytics signals under their existing PMF consent. First-party
   only (hard guard) and consent-gated; no new data category, no third-party sharing.
2. **Autonomy — all non-sensitive functions, owner-delegated.** Every non-sensitive (auto_ok) domain runs at
   full autonomy. The permanent gates — money, identity, legal, pricing, tier — stay human/counsel-gated no
   matter what, and the kill switch overrides everything.
3. **Auto-apply when live.** Before launch the AI collects, learns, and recommends only. Once the site is live
   it applies its non-sensitive decisions automatically, inside the same gates.
4. **Model target — fully working by 2026-12-31.** A documented milestone with a readiness surface; it does
   not itself gate anything.
5. **Tier 1 — no fill deadline; benefit year starts at the 200k-user milestone.** The offer stays open until
   the availability cap is reached, however long that takes. A member's 100%-keep year does not begin at
   signup — it starts on the date the premium-user milestone is reached (or their join date, if later).

## Founding first-party data collection

`backend/sdk/founding-data.ts` collects the founding panel's activity comprehensively so the AI model can
learn from it — but it is deliberately incapable of collecting a *new* data category. A built-in **manifest**
enumerates the first-party, already-disclosed categories (profile, preferences, interactions, feature use,
surveys, engagement, feedback, referrals, transactions, session telemetry, support). The **hard guard**
(`FOUNDING_DATA_FIRST_PARTY_ONLY`, on by default) refuses at write time any category not marked first-party in
the manifest, so turning "collect everything" on can never quietly become "collect a new kind of personal
data" — that would require a privacy-policy update and counsel first. Collection is **consent-gated**: a
member's signal is only recorded once their founding/PMF consent is on file (consent ledger).

`recordFoundingSignal()` is the unified recorder (never throws; no-ops when disabled, disallowed, or without
consent). It is wired into the existing feature entry point (`recordFeatureUse`) so the founding panel's
feature use is captured automatically, and a `foundingSignalRecord` endpoint lets any surface push a
first-party signal. The interaction telemetry already captures all in-app interactions for everyone including
founders; this layer adds the unified, documented, consent-guarded founding store on top. `foundingDataScope`
(admin read) shows exactly what is — and isn't — collected: the manifest plus per-category volume.

## The AI runs autonomously — up to the compliance wall

The Autonomy Kernel (`backend/sdk/autonomy-kernel.ts`) already classifies every automatable domain as either
**auto_ok** (safe, reversible, high-volume) or **permanent_gate** (money / identity / legal / risk — never
auto, no matter how much data exists). This build adds one owner-delegated switch,
`AUTONOMY_AUTO_OK_DEFAULT_MODE`, defaulted to **full**: every non-sensitive domain with no explicit override
now runs at full autonomy. `resolvePolicy` stays pure — callers pass the delegated default — and it still
forces every permanent-gate domain to "manual". The kill switch (`AUTONOMY_KILL_SWITCH`) remains the master
brake over all of it.

`backend/sdk/ai-autonomy.ts` is the one place that answers "may an AI process auto-apply a non-sensitive change
right now?" It composes the delegated default, the live gate, and the global brakes into an
`autoApplyMode()` of **apply / advisory / off**. It can only make the AI *more* conservative — it never
authorizes a sensitive or permanent-gate action; those stay walled off by the kernel and by the optimizer's
`COMPLIANCE_DENYLIST` + sensitive/price checks.

## Auto-apply once the site is live

`AI_APPLY_WHEN_LIVE` (on) + `SITE_LIVE` (off until launch) gate the behavior. Before launch, the optimizer
records its non-sensitive proposals as **advisory** recommendations instead of applying them — the AI
collects, learns, and recommends only. Once `SITE_LIVE` is on, the same non-sensitive changes auto-apply
(audited, bounded, outcome-tracked, auto-reverted on regression, exactly as before), while money/price/legal
knobs stay on the human-approval path. The founding data is routed **into** the optimizer's own learning
snapshot (`collectSignals` now records founding signal volume + active founders as trend metrics), so the AI
literally learns from the collected data and, once live, acts on it.

`AI_MODEL_ENABLED` is the model master switch; `AI_MODEL_TARGET_DATE` (2026-12-31) is the "fully working"
milestone. `aiModelReadiness` (admin read) reports the live auto-apply mode and why, the non-sensitive
autonomy default, the permanent-gate count that stays human-gated, the founding-data volume feeding the model,
and the days remaining to the target.

## Tier 1: no fill deadline, benefit year anchored to the 200k-user milestone

Two founding-offer mechanics changed in `backend/sdk/founding-advertiser.ts`:

- **No time limit to fill Tier 1** (`FOUNDING_FILL_NO_TIME_LIMIT`, on). The offer stays open until the
  availability cap (`FOUNDING_ADVERTISER_SLOTS`) is reached, however long that takes; the milestone deadline
  stays blank.
- **Benefit year starts at the milestone** (`FOUNDING_TERM_STARTS_AT_MILESTONE`, on). A Tier 1 member's
  100%-keep year is anchored to the date the premium-user milestone (200,000) is reached — not to signup.
  Members who join after the milestone start from their join date. Until the milestone is reached the year has
  not started: the window does not count down and the member keeps their in-window rate.
  `foundingProgramMilestone` stamps `FOUNDING_MILESTONE_USERS_REACHED_AT` the first time the 200k-user gate is
  met (idempotent), and `foundingFullKeepStatus` anchors the window to it (returning `term_started` /
  `term_start`).

## Guardrails preserved

- **The closed loop is untouched.** No new money-movement, credit, or cash-equivalent surface. Users still
  receive only non-cashable Site Cash; only businesses are paid real money.
- **Permanent gates stay permanent.** Payouts, refunds, billing changes, KYC/tax, disputes, account actions,
  and legal/public claims never auto-approve — the kernel forces them to manual regardless of the autonomy
  default, and the kill switch overrides everything.
- **No new data category.** The first-party hard guard refuses anything outside the disclosed manifest; the
  founding store is consent-gated and feeds the internal model only. No third-party sharing.
- **No ROI/return promise.** The founding value framing, the value stacks, and the "no performance guarantee"
  posture are unchanged. The benefit-year timing change is a term definition, not a return.

## Components

- SDK: `founding-data.ts`, `ai-autonomy.ts`; edits to `autonomy-kernel.ts` (owner default), `optimizer.ts`
  (auto-apply-when-live gate + founding signals), `feature-pmf.ts` (founding capture hook),
  `social-endorser-engine.ts` (default pass-through), `founding-advertiser.ts` (term anchoring).
- Functions: `foundingSignalRecord` (record a first-party signal), `foundingDataScope` (admin read),
  `aiModelReadiness` (admin read); edits to `foundingProgramMilestone` (stamp the anchor), `autonomyStatus`,
  `autonomyDecide`, `endorserPersonalizePost`.
- Entity: `FoundingDataSignal` (+ schema).
- Settings (Automation): `AUTONOMY_AUTO_OK_DEFAULT_MODE`, `AI_MODEL_ENABLED`, `AI_MODEL_TARGET_DATE`,
  `SITE_LIVE`, `AI_APPLY_WHEN_LIVE`. (Scale & Platform): `FOUNDING_DATA_COLLECTION_ENABLED`,
  `FOUNDING_DATA_FIRST_PARTY_ONLY`, `FOUNDING_DATA_REQUIRE_CONSENT`, `FOUNDING_DATA_MANIFEST_JSON`.
  (Founding Advertiser): `FOUNDING_FILL_NO_TIME_LIMIT`, `FOUNDING_TERM_STARTS_AT_MILESTONE`,
  `FOUNDING_MILESTONE_USERS_REACHED_AT`.
