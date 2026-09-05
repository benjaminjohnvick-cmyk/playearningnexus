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
   the posture toward escrow/custodial treatment.

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
5. **Use-of-funds commitment:** whether the owner should state that founding revenue will be used **only** to
   complete the offer (reach 200k users) and nothing else — and if so, **how**: (a) as a **binding covenant**
   (creates a duty to honor and to evidence the spend; deviation is a breach) or a **non-binding statement of
   current intent** (softer, but still a representation that must be truthful when made); and (b) how that
   commitment squares with the funds model — under non-refundable **presale** it is a voluntary reassurance,
   but describing funds as held-and-earmarked-for-a-purpose can look **escrow/custodial**, with the attendant
   segregation, accounting, and refund-path duties. Please also advise what books/records evidence would be
   expected to substantiate "spent only on completing the offer," and whether any spend categories (e.g.
   founder salary, overhead, infrastructure that also serves the milestone) are in- or out-of-scope.

## Appendix — DRAFT use-of-funds statement of intent (for counsel review; NOT live)

*The following is draft wording only. It is **not** published in any member-facing document, terms of service,
or marketing surface, and must not be used until counsel has reviewed it and decided whether it should be a
binding covenant or a non-binding statement of intent, and finalized the language. Two variants are offered so
counsel can choose the posture.*

**Variant A — statement of current intent (softer):**
> "We intend to use founding contributions to build toward launch — specifically, to reach the user base the
> pre-revenue offer is built around (our 200,000-member target). It is our present intention not to divert
> these contributions to unrelated purposes. This describes our intent; it is not a guarantee of any outcome or
> financial return, and it is not a promise that every dollar is escrowed or segregated."

**Variant B — commitment/covenant (stronger; only if counsel advises it can be honored and evidenced):**
> "We commit that founding contributions will be applied solely toward completing the founding offer — reaching
> our 200,000-member milestone and the delivery it enables — and will not be spent on unrelated purposes. We
> will maintain records sufficient to substantiate this use of funds. This is a commitment about how funds are
> used; it is not, and must not be read as, a promise of any financial return, profit, or investment outcome."

*Open drafting questions for counsel, tied to confirm-point 5: binding vs. intent; escrow/segregation
implications; the definition of "completing the offer" (which spend categories count); and the records/evidence
standard. Nothing here changes the closed loop, the no-ROI posture, or any permanent gate.*

*Cross-references: `AUTONOMOUS-AI-AND-FOUNDING-DATA-DESIGN.md` (design), `TIERED-FEATURE-CATALOG-AND-PMF.md`,
`FOUNDING-PRE-REVENUE-OFFER-AND-TIER1-SPEC.md`, `FOUNDING-OFFER-LEGAL-REVIEW.md`,
`TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md`, `TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`,
`STRICTEST-STANDARD-COMPLIANCE-POLICY.md`, `PRIVACY-POLICY.md`, `FOR-YOUR-ATTORNEY.md`.*
