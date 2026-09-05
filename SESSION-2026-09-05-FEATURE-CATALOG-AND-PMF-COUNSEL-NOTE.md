# Counsel Note — Tiered Feature Catalog + AI PMF/Revenue Agent (2026-09-05)

*For the attorney. Documents the product/infra features added on 2026-09-05 and confirms they were built to
preserve every existing constraint. Nothing here creates a new money-movement, credit, or identity surface.
**Not legal advice** — the confirm-points at the end are for counsel.*

## What was added

1. **Tiered advertiser feature catalog** (`advertiser-features.ts`). The advertiser-facing revenue streams (the
   subset of the 8-category revenue map an advertiser actually buys — sponsored surveys, audience panels,
   brand-lift/insight reports, in-app placements, lead-gen, and the gated offerwall/rewarded-video/API/
   AI-creative options) are now presented as **add-on features across Tiers 1–3**. User-facing streams
   (cosmetics, boosts) and structural fees are **not** tier features.

2. **AI Feature PMF scoreboard** (`feature-pmf.ts`). Ranks each advertiser feature by product-market fit,
   **retention-weighted**, using adoption, engagement, the feature's own revenue (its slice of the existing
   `RevenueEvent` ledger), and a return-rate. A light `FeatureUsageEvent` log records that a feature was used.

3. **AI PMF & revenue agent** (`pmf-agent.ts`, scheduled). Collects the above signals into the existing
   `OptimizationSignal` trend store, produces a per-feature action plan (promote/hold/watch/fix/sunset with an
   advisory pricing direction), records learning, and runs continuously.

4. **Complete revenue-stream coverage — all 45 sub-points** (`revenue-coverage.ts`, `revenueStreamCoverage`).
   Locked scope: **track all 45 revenue sub-points; tier the advertiser/business-facing ones.** The four
   remaining business-facing streams were added to the tier catalog (**B2B SaaS suite** — Tier 2; **managed
   hosting** and **fraud-as-a-Service** — Tier 3, both gated; **sponsored jackpots** — Tier 1), bringing the
   tiered advertiser features to **19**. A coverage map then reports **every** one of the 45 streams across all
   8 categories — with its real revenue (its `RevenueEvent` slice), status (built/gated/counsel), live/pending,
   and whether it is a tiered feature — so **none is invisible**. User-facing (cosmetics, boosts, season pass),
   seller-side (commissions, sourcing, affiliate), and structural-fee (BNPL, shipping, FX) streams are **not**
   advertiser tier features — an advertiser cannot "buy" a shipping spread — but they are all revenue-tracked.
   Retention-PMF ranking stays on the advertiser subset (where "do adopters come back" is meaningful); revenue
   coverage spans all 45.

## Guardrails preserved (the point of this note)

- **No revenue/ROI/return promise anywhere.** Tier "value" remains **advertising value delivered** at
  conventional rates, exactly as in the existing TIER1/2/3 value-stack docs. Pricing is **held**; adding live
  features only makes the *delivered-value ratio* climb — no number is tied to an advertiser's sales.
- **Nothing is oversold.** A **gated** feature (needs a third-party account) or **counsel** feature contributes
  **$0** of claimed value and is labeled "activates when its prerequisite lands" until it is actually live —
  the same on/off-toggle rule the value stacks already follow.
- **The closed loop is untouched.** No feature here books money to a user, creates a cash-equivalent, or moves
  value user-to-user. Users still receive only non-cashable Site Cash; only businesses are paid real money.
- **Every sensitive move stays human-gated.** The AI agent **writes an advisory plan and learning only**. It
  does **not** auto-change money, pricing, tiers, identity, or legal settings. Each price/tier/sunset move is
  flagged "needs approval" and routed through the same admin-approval path the optimizer and Autonomy Kernel
  already enforce (money/identity/legal are permanent human gates). No new autonomy over regulated domains.
- **The founding PMF panel is a measured PRIVILEGE, not a quota.** Founding / pre-revenue Tier 1 members get
  the whole catalog free and are *asked* to exercise features; the system only **observes** usage. There is
  **no** "use N features / give M pieces of feedback → get $X" mechanic — it is not compensation for feedback,
  consistent with the existing founding-offer framing (feedback/beta role is a founding privilege).
- **Privacy posture unchanged.** `FeatureUsageEvent` is aggregate product analytics of the same first-party
  interaction signals already collected and disclosed (feedback auto-collection, telemetry, session capture).
  No new category of personal data, no third-party sharing; it feeds internal ranking only.
- **18+, jurisdiction, disclosure, and consent gates** are all upstream of these features and unchanged.

## For counsel to confirm

1. That presenting the advertiser revenue streams as tiered add-on features — with price held and only *live*
   features counted toward delivered value — stays within the existing value-stack / no-performance-guarantee
   posture already reviewed.
2. That the `FeatureUsageEvent` product-analytics collection is covered by the current privacy policy and data
   disclosures (it reuses already-disclosed first-party signals; no new data category or sharing).
3. That an AI agent which **only** produces advisory recommendations + learning — with every price/tier/money
   change held for human approval — introduces no new autonomy concern beyond the already-reviewed optimizer /
   Autonomy Kernel model.
4. That the founding "whole catalog free, please help us find fit" framing remains a **privilege**, not
   compensation for labor, given there is no quota and no payment tied to feedback.
5. That folding the four business-facing streams (B2B SaaS, managed hosting, fraud-as-a-Service, sponsored
   jackpots) into the tiers — with the two gated ones counted at **$0** delivered value until their prerequisite
   lands, and the complete 45-stream coverage map being an **internal analytics read only** (no user-facing
   claim) — stays within the same value-stack / no-performance-guarantee posture as points 1–3.

*Cross-references: `TIERED-FEATURE-CATALOG-AND-PMF.md` (design), `TIER1/2/3-VALUE-STACK.md`,
`REVENUE-STREAMS-EXPANSION.md`, `FOUNDING-PRE-REVENUE-OFFER-AND-TIER1-SPEC.md`, `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`,
`FOR-YOUR-ATTORNEY.md`. Components this pass: `backend/sdk/revenue-coverage.ts`,
`backend/functions/revenueStreamCoverage`, `REVENUE_COVERAGE_ENABLED` setting, `FeaturePMF.jsx` "All revenue
streams — coverage" section.*
