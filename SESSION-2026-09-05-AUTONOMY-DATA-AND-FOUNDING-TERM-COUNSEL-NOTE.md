# Counsel Note — Autonomous AI, Founding Data & Tier 1 Benefit-Year Timing (2026-09-05)

*For the attorney. Documents three product/infra changes made on 2026-09-05 and confirms they were built to
preserve every existing constraint. Nothing here creates a new money-movement, credit, or identity surface.
**Not legal advice** — the confirm-points at the end are for counsel.*

## What was added

1. **Comprehensive FIRST-PARTY founding data collection** (`founding-data.ts`, `foundingSignalRecord`,
   `foundingDataScope`). The pre-revenue / founding panel's activity is collected comprehensively as
   first-party product-analytics signals (`FoundingDataSignal`) for the AI model to learn from. It reuses only
   already-disclosed first-party categories (profile, preferences, interactions, feature use, surveys,
   engagement, feedback, referrals, closed-loop transactions, session telemetry, support). A **hard guard**
   (`FOUNDING_DATA_FIRST_PARTY_ONLY`, on) refuses any category not marked first-party in the manifest at write
   time, and collection is **consent-gated** (founding/PMF consent on file). No new data category; no
   third-party sharing; feeds the internal model only.

2. **Full autonomy for NON-sensitive AI functions, auto-applying once live** (`ai-autonomy.ts`, owner default
   in `autonomy-kernel.ts`, gate in `optimizer.ts`). Every non-sensitive (auto_ok) domain runs at full
   autonomy by owner delegation. Before launch the AI only collects/learns/recommends; once `SITE_LIVE` is on
   it auto-applies non-sensitive changes (audited, bounded, outcome-tracked, auto-reverted on regression). A
   model target date (`AI_MODEL_TARGET_DATE`, 2026-12-31) and an admin readiness read (`aiModelReadiness`)
   were added.

3. **Tier 1: no fill deadline; benefit year anchored to the 200k-user milestone** (`founding-advertiser.ts`,
   `foundingProgramMilestone`). The founding offer stays open until the availability cap is reached, with no
   time limit. A Tier 1 member's 100%-keep benefit year starts on the date the premium-user milestone
   (200,000) is reached — not at signup; members who join later start from their join date. The reached-at
   date is stamped once, idempotently, the first time the gate is met.

4. **Owner use-of-funds commitment (proposed — NOT yet in live terms).** The owner wishes to commit that
   founding revenue will be applied **only** toward completing the offer — i.e., reaching the 200,000-user
   milestone the pre-revenue offer is built around — and not spent on anything else. This is documented here
   as a **statement of intent for counsel's review** (draft wording in the appendix). It is deliberately **not
   wired into any member-facing or live term** pending counsel's decision on (a) whether to make it a binding
   covenant or a non-binding statement of current intent, and (b) how it interacts with the funds model
   (`FOUNDING_FUNDS_MODEL`: presale / escrow / hybrid), since earmarking funds for a specific purpose can shift
   the posture toward escrow/custodial treatment. **(Superseded — see confirm-point 5, revised 2026-09-13, for
   the current two-phase use-of-funds posture.)**

## Guardrails preserved (the point of this note)

- **The closed loop is untouched.** No feature here books money to a user, creates a cash-equivalent, or moves
  value user-to-user. Users still receive only non-cashable Site Cash; only businesses are paid real money.
- **Permanent gates stay permanent.** The Autonomy Kernel forces every money / identity / legal / risk domain
  (payouts, refunds, billing changes, KYC/tax, disputes, account actions, legal & public claims) to "manual"
  regardless of the new autonomy default; the optimizer's `COMPLIANCE_DENYLIST` + sensitive/price checks keep
  money/price/legal knobs on the human-approval path; and the global kill switch overrides everything. The
  autonomy change can only make the AI *more* conservative than before launch — it never widens what may be
  automated in the regulated domains.
- **No new data category, no new sharing.** The first-party hard guard refuses anything outside the disclosed
  manifest; `FoundingDataSignal` is aggregate first-party product analytics of already-disclosed signals,
  consent-gated, fed to the internal model only. Privacy posture unchanged.
- **No revenue/ROI/return promise.** The founding value framing and value stacks are unchanged. The benefit
  year is a **term definition** (when the 100%-keep window runs), not a financial return; anchoring it to the
  milestone does not tie any number to an advertiser's sales.
- **Members are never auto-charged.** The member shortfall charge remains coded off. Nothing in the term-timing
  change bills or debits a member.

## For counsel to confirm

1. That collecting the founding panel's first-party activity comprehensively — restricted by the hard guard to
   already-disclosed first-party categories, consent-gated, internal-only, no third-party sharing — is covered
   by the current privacy policy and disclosures (no new data category is introduced).
2. That delegating full autonomy to the non-sensitive domains — with money, identity, legal, pricing, and tier
   changes held to permanent human/counsel gates and a kill switch over all of it, and with auto-apply
   suppressed until go-live — introduces no new autonomy concern beyond the already-reviewed optimizer /
   Autonomy Kernel model.
3. **Tier 1 "no time limit to fill":** that removing a fill deadline is acceptable under the chosen funds
   model. Note the interaction with escrow/hybrid: if founding funds are escrowed/refundable pending the
   milestone and there is no deadline by which the milestone must be met, there is no automatic refund trigger
   — please confirm the refund path (or that the non-refundable presale model, where this is moot, is the one
   in force). This is the one item that materially interacts with consumer-protection/escrow terms.
4. **Benefit-year timing:** that starting each Tier 1 member's 100%-keep year at the 200k-user milestone rather
   than at signup — during which the member keeps their in-window rate but the clock has not begun — is
   consistent with the founding-offer terms and disclosures the member accepts, and with any auto-renewal /
   term-length representations.
5. **Use-of-funds posture (REVISED 2026-09-13 — TWO-PHASE):** the owner wants the letter to state that founding
   contributions are **non-refundable** and are **directed to user acquisition until BOTH** the **200,000-user
   prelaunch milestone** and an **additional 200,000 regular users** (the audience founders advertise to;
   ~400,000 total) are reached; **once both milestones are met, the funds are the owner's to allocate at
   discretion for any lawful business purpose** (a purchase of advertising/membership, **not** funds held in
   trust). This supersedes both the earlier "spent only on completing the offer" draft and the 2026-09-05
   "discretion once the offer is filled" draft. Please confirm this two-phase posture is consistent with the
   funds model (`FOUNDING_FUNDS_MODEL`) and with every refund/escrow representation the buyer sees, and note that
   earmarking funds to user acquisition during Phase 1 may shift that phase toward escrow/custodial treatment —
   reconcile accordingly.
6. **Post-year deliverable + audience figures (REVISED 2026-09-13):** the letter adds two forward statements —
   (a) the founding funds are **directed to acquiring the 200,000 prelaunch users plus an additional 200,000
   regular users (~400,000 total)** for founders to advertise to, after which the funds are at the owner's
   discretion; and (b) each founding business receives a **free additional year of marketing access to that
   audience** as part of the offer. Please confirm the framing needed to stay within the no-performance-guarantee
   posture: the free marketing year is a concrete **new delivery obligation** (it must be added to the value
   stack / delivery guarantee and actually honored), and the **user figures should read as goals/targets, not
   guaranteed counts of reachable users**, so they aren't an audience-size or results guarantee. Confirm the
   interaction with the existing capacity-paced, "advertising delivered — not audience/results/ROI" disclosure,
   and whether the free-marketing-year benefit needs its own delivery-guarantee wording.

## Appendix — DRAFT use-of-funds statement of intent (for counsel review; NOT live)

*The following is draft wording only. It is **not** published in any member-facing document, terms of service,
or marketing surface, and must not be used until counsel has reviewed it and decided whether it should be a
binding covenant or a non-binding statement of intent, and finalized the language. Two variants are offered so
counsel can choose the posture.*

**Variant A — statement of current intent (softer):**
> "Founding contributions are a non-refundable purchase of advertising and membership — not funds held in trust.
> Until we have (1) reached the 200,000-user prelaunch milestone and (2) acquired an additional 200,000 regular
> users for founding businesses to advertise to (about 400,000 users in total), we direct these funds to
> acquiring those users and building that audience. Once both milestones are met, we may use these funds at our
> discretion for any lawful business purpose. As part of this offer we also give each founding business an
> additional year of marketing access to the platform's user audience at no extra charge. These statements
> describe our plans and the value we intend to deliver; the user figures are goals, and nothing here guarantees
> any specific audience size, reach, result, revenue, or financial return."

**Variant B — commitment/covenant (stronger; only if counsel advises it can be honored and evidenced):**
> "Founding contributions are non-refundable. Until we have reached the 200,000-user prelaunch milestone and
> acquired a further 200,000 regular users for founding businesses to advertise to (about 400,000 users in
> total), these funds are directed to acquiring those users and building that audience; once both milestones are
> met, they are ours to use at our discretion for any lawful business purpose. As part of the founding offer we
> commit to provide each founding business a free additional year of marketing access to the platform's user
> audience following the founding year. The user figures are goals, not guaranteed counts of reachable users, and
> nothing here is a promise of sales, revenue, profit, or investment return."

*Open drafting questions for counsel, tied to confirm-points 5–6: (a) the **two-phase** "non-refundable,
directed to user acquisition until the 200,000 prelaunch + 200,000 additional users are reached, then owner's
discretion for any lawful business purpose" posture vs. the funds model and any refund/escrow language it
reverses — including whether Phase 1 earmarking leans toward escrow/custodial treatment; (b) framing the user
figures as goals, not guaranteed reachable-audience counts; (c) whether the free additional marketing year needs
its own delivery-guarantee wording and a place in the value stack. Nothing here changes the closed loop, the
no-ROI posture, or any permanent gate.*

*Cross-references: `AUTONOMOUS-AI-AND-FOUNDING-DATA-DESIGN.md` (design), `TIERED-FEATURE-CATALOG-AND-PMF.md`,
`FOUNDING-PRE-REVENUE-OFFER-AND-TIER1-SPEC.md`, `FOUNDING-OFFER-LEGAL-REVIEW.md`,
`TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md`, `TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`,
`STRICTEST-STANDARD-COMPLIANCE-POLICY.md`, `PRIVACY-POLICY.md`, `FOR-YOUR-ATTORNEY.md`.*
