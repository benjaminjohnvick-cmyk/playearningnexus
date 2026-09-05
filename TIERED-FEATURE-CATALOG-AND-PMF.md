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

## Usage tracking — auto-wired (2026-09-05)

Adoption/engagement now populate **automatically**. Rather than editing every feature function, the tracker is
hooked into `recordRevenue()` (`revenue.ts`) — the shared entry point every advertiser feature already calls to
book its revenue. `recordFeatureUseForRevenue()` maps the event's `type` to the catalog feature(s) and logs a
`FeatureUsageEvent` (attributing the advertiser). If a caller tags the event with `meta.feature_key` it's
precise; otherwise every feature that books that revenue type is credited. Best-effort — it never blocks the
ledger. A front-end `featureUsageTrack({ feature_key })` call is still available for surfaces that don't book
revenue on use, but the core adoption/engagement now flows on its own.

## The AI PMF & revenue agent (2026-09-05)

`backend/sdk/pmf-agent.ts` + `pmfRevenueAgentRun` (scheduled every 6h, 20 min after the scoreboard) close the
loop the owner asked for: an agent that **collects all the feature/site signals, ranks the portfolio for
product-market fit and increased revenue, and learns** — while **keeping every existing constraint**.

- **Collect** — writes `pmf_score:<key>` and `feature_revenue:<key>` into the shared `OptimizationSignal` trend
  store, so the whole AI layer sees them.
- **Plan** — `decideAction()` turns each feature's PMF + revenue into an action: **promote / hold / watch /
  fix / sunset**, with an advisory pricing hint (raise / hold / lower). Strong fit + above-median revenue →
  promote and *consider* a price move; strong fit + low revenue → promote to grow adoption first; weak fit +
  negative retention → sunset candidate; too few adopters → watch (gather more signal).
- **Learn** — durable `AgentLearningMemory` lessons under agent `pmf_revenue_agent`, so it trends in the
  existing learning dashboards and compounds with the platform's other self-learning.
- **Constraints preserved** — the agent writes signals, learning, and an **advisory plan** to `PmfAgentPlan`;
  it does **not** auto-change money, pricing, tiers, identity, or legal settings. Every sensitive move (price,
  sunset, fix-with-discount) is flagged `needs approval` — the same human gate the optimizer and Autonomy
  Kernel already enforce. No ROI claims; the closed loop is untouched. Runs continuously so discovery keeps
  improving after launch.

Settings: `PMF_AGENT_ENABLED`, `PMF_AGENT_RECOMMEND_PRICING`, `PMF_AGENT_STRONG_SCORE`, `PMF_AGENT_WEAK_SCORE`,
`PMF_AGENT_MIN_SAMPLE`. The plan is shown on the `FeaturePMF` admin page and returned by `featurePmfScoreboard`.
