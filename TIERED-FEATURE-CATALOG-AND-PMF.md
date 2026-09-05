# Tiered Advertiser Feature Catalog + AI PMF Scoreboard

*Built 2026-09-05. Turns the advertiser-facing revenue streams into add-on features across Tiers 1–3, and adds
an AI product-market-fit scoreboard that ranks features by retention. Decisions locked with the owner. Values
are **advertising value delivered / measured activity** — never a revenue or ROI promise. Not legal advice.*

## Decisions (locked)

1. **Scope — advertiser features only.** Only advertiser-facing streams become tier features (clean fit for the
   advertiser tiers). User-facing streams (cosmetics, boosts) and structural fees are **tracked** by the
   scoreboard but are not tier features.
2. **Pricing — hold prices, ratio climbs.** Adding live features raises each tier's delivered-value stack; the
   price is held, so the value **ratio** climbs (more value for the same money). No price change, no ROI claim.
3. **PMF weighting — retention-weighted.** The score leans hardest on retention lift (do adopters come back),
   the truest PMF signal; adoption, engagement, and per-feature revenue fill in the rest.
4. **Founding role — a measured privilege, not a quota.** Founding / pre-revenue Tier 1 gets the **whole
   catalog free** and is the PMF panel; the AI *observes* what founders use — it never enforces a quota
   (which keeps it clear of the "paying for feedback" line).

## The tiered feature catalog

`backend/sdk/advertiser-features.ts` — each advertiser-facing revenue stream is an add-on feature with a tier,
a conventional value, a readiness (**live / gated / counsel**), and the RevenueEvent `type` it books to. A
gated/counsel feature is listed as *"included — activates when its prerequisite lands"* and contributes **$0**
of claimed value until it is live (same rule as the value stacks: every line respects its own toggle).

- **Tier 1:** sponsored survey campaign, audience pulse, in-app interstitials, lead-gen program.
- **Tier 2 "Scale":** Pro audience panels, brand-lift studies, competitive reports, plus gated offerwall/CPA,
  rewarded video, sponsored push/email, API access, self-serve AI creative studio.
- **Tier 3 "Unlimited":** product-testing panel, white-label/RaaS, survey-routing arbitrage — all tiers below.
- **Founding:** the entire catalog, free.

`advertiserFeatureCatalog` (read) returns the catalog + a per-tier rollup: live vs. pending counts and the
**delivered value added** (what makes the ratio climb, price held). Layered **additively** — it does not mutate
the tested Tier 1/2/3 value stacks.

## The AI PMF scoreboard

`backend/sdk/feature-pmf.ts` ranks every feature by a retention-weighted **PMF score (0–100)**:

- **Retention lift** (weight 0.45) — of a feature's prior-window adopters, the fraction active again in the
  recent window, minus the site baseline, **shrunk toward 0 for low samples** (`n/(n+K)`) so a feature only a
  handful tried can't top the board on noise.
- **Adoption** (0.20, distinct users), **engagement** (0.15, uses per adopter), **revenue** (0.20, the
  feature's slice of the one RevenueEvent ledger). All admin-tunable (`PMF_WEIGHT_*`, `PMF_WINDOW_DAYS`,
  `PMF_SHRINK_K`).
- **Per-tier revenue ranking** — "which features earn the most, for each tier," plus the tier's revenue total.
- **Founding segmentation** — usage is logged with a `founding` flag so the panel is measured separately.

**Runs continuously.** `featurePmfScoreboardRun` is on the scheduler every 6h (authorized by the scheduler's
signed token, same pattern as the scaling governor), so PMF discovery keeps going after launch — the founding
rankings and the operational rankings become a before/after.

## Components

- SDK: `advertiser-features.ts`, `feature-pmf.ts`.
- Functions: `advertiserFeatureCatalog`, `featurePmfScoreboard` (admin read), `featurePmfScoreboardRun`
  (scheduled build), `featureUsageTrack` (records a use; reads the user's founding flag).
- Entities: `FeatureUsageEvent`, `FeaturePmfSnapshot`.
- Admin page: `src/pages/FeaturePMF.jsx` (ranked scoreboard + per-tier revenue view).
- Schedule: `feature-pmf-scoreboard` (`0 */6 * * *`).
- Settings (Scale & Platform): `ADVERTISER_FEATURE_CATALOG_ENABLED`, `ADVERTISER_FEATURE_CATALOG_JSON`,
  `FEATURE_PMF_ENABLED`, `PMF_WEIGHT_RETENTION/ADOPTION/ENGAGEMENT/REVENUE`, `PMF_WINDOW_DAYS`, `PMF_SHRINK_K`.

## Wiring note (the one hook to finish)

The scoreboard fills as features are **used**. Adoption/engagement come from `featureUsageTrack` (or a backend
call to `recordFeatureUse`), and revenue comes automatically from the RevenueEvent ledger by type. To make
adoption/engagement fully live, call `featureUsageTrack({ feature_key })` from each feature's entry point (the
revenue and retention signals already flow from existing data). Until those calls are wired, revenue-per-feature
and the per-tier revenue ranking work immediately; adoption/engagement populate as the tracker is hooked in.
