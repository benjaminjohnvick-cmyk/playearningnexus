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
5. **Use-of-funds posture (REVISED 2026-09-05 — reverses the earlier draft):** the owner now wants the letter
   to state that founding contributions are **non-refundable** and, **once the offer is filled, are the owner's
   to allocate at discretion** (a purchase of advertising/membership, **not** funds held in trust or ring-fenced).
   This **reverses** the earlier "spent only on completing the offer" draft. Please confirm this "purchase, not
   custodial funds" posture is consistent with the funds model (`FOUNDING_FUNDS_MODEL`) and with every refund /
   escrow representation the buyer sees, and reconcile or remove any prior escrow/earmark language so the two
   don't conflict.
6. **Post-year deliverable + audience figure (NEW 2026-09-05):** the letter now adds two forward statements —
   (a) after the founding year the owner will invest funds in **acquiring a ~200,000-user audience**, and
   (b) each founding business receives a **free additional year of marketing access to that audience** as part
   of the offer. Please confirm the framing needed to stay within the existing no-performance-guarantee posture:
   the free marketing year is a concrete **new delivery obligation** (it must be added to the value stack /
   delivery guarantee and actually honored), and the **200,000-user figure should read as a goal/target, not a
   guaranteed count of reachable users**, so it isn't an audience-size or results guarantee. Confirm the
   interaction with the existing capacity-paced, "advertising delivered — not audience/results/ROI" disclosure,
   and whether the free-marketing-year benefit needs its own delivery-guarantee wording.

## Appendix — DRAFT use-of-funds statement of intent (for counsel review; NOT live)

*The following is draft wording only. It is **not** published in any member-facing document, terms of service,
or marketing surface, and must not be used until counsel has reviewed it and decided whether it should be a
binding covenant or a non-binding statement of intent, and finalized the language. Two variants are offered so
counsel can choose the posture.*

**Variant A — statement of current intent (softer):**
> "Founding contributions are a non-refundable purchase of advertising and membership — not funds held in trust.
> Once the founding offer is filled, we may allocate these funds at our discretion. As part of this offer, we
> intend — after the founding year is complete — to invest in growing the platform's audience toward a
> 200,000-member base, and to give each founding business an additional year of marketing access to that
> audience at no extra charge. These statements describe our plans and the value we intend to deliver; they are
> not a guarantee of any specific audience size, reach, result, revenue, or financial return."

**Variant B — commitment/covenant (stronger; only if counsel advises it can be honored and evidenced):**
> "Founding contributions are non-refundable and, once the offer is filled, are ours to allocate as we
> determine. As part of the founding offer, we commit to provide each founding business a free additional year
> of marketing access to the platform's user audience following the founding year, and we intend to grow that
> audience toward a 200,000-member target. We will maintain records of this investment. This is a commitment to
> deliver the additional marketing year described; the 200,000-member figure is a goal, not a guaranteed count
> of reachable users, and nothing here is a promise of sales, revenue, profit, or investment return."

*Open drafting questions for counsel, tied to confirm-points 5–6: (a) the "non-refundable purchase, owner's
discretion after fill" posture vs. the funds model and any refund/escrow language it reverses; (b) framing the
200,000-user figure as a goal, not a guaranteed reachable-audience count; (c) whether the free additional
marketing year needs its own delivery-guarantee wording and a place in the value stack. Nothing here changes
the closed loop, the no-ROI posture, or any permanent gate.*

*Cross-references: `AUTONOMOUS-AI-AND-FOUNDING-DATA-DESIGN.md` (design), `TIERED-FEATURE-CATALOG-AND-PMF.md`,
`FOUNDING-PRE-REVENUE-OFFER-AND-TIER1-SPEC.md`, `FOUNDING-OFFER-LEGAL-REVIEW.md`,
`TIER-AUTORENEW-COMPLIANCE-COUNSEL-NOTE.md`, `TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`,
`STRICTEST-STANDARD-COMPLIANCE-POLICY.md`, `PRIVACY-POLICY.md`, `FOR-YOUR-ATTORNEY.md`.*
