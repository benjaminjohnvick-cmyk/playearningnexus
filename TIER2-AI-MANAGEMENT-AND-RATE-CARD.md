# Tier 2 — AI-Managed Delivery & Conventional Rate Card

*How the $200,000 Tier 2 "Scale" package (options A–D) is delivered by a dedicated AI system with no
per-advertiser human staffing, at near-zero marginal cost, and how its conventional list value backs the
price. Current as of 2026-08-15. Admin-tunable; market values are benchmark estimates, not guarantees; not
legal advice.*

## The idea

Every Tier 2 deliverable is served by an AI engine that already runs on the platform, so the whole package
is self-serving — you can sell it to your first advertiser without hiring an account team, and to your
hundredth without hiring a hundred. Flag: `ai_ad_manager` (ON) / `AI_AD_MANAGER_ENABLED`. SDK:
`backend/sdk/ai-ad-manager.ts`. Endpoints: `aiAdManagerStatus` (the rate card + what's delivered so far) and
`aiAdManagerRun` (the orchestrator that dispatches due deliverables to their engines).

## Two honesty rules (what keeps the value real, not deceptive)

1. **Research uses REAL respondents.** Audience-panel and brand-lift studies are AI-designed, AI-fielded, and
   AI-analyzed — but they are fielded to your **real, consented** survey audience via `createAudiencePanel`.
   The value is real human responses. The AI never fabricates a "study"; that would be worthless and deceptive.
2. **The manager is labeled as AI.** The account line is an **always-on AI campaign manager** (with optional
   human escalation), never a "dedicated success manager." An AI agent is a real product but it is not a human,
   so it isn't sold as one. Its full listed value assumes the human-escalation option backs it; pure-AI-only
   would carry a lower value.

These two rules are why the AI system can hold the price: it automates *delivery*, not *substance*.

## The conventional rate card (A–D)

Each line is a standard, market-recognized product at a conventional rate, delivered by the named AI engine.
Values are admin-tunable via `TIER2_RATE_CARD_JSON`.

### A. Advertising media — $99,000

| Deliverable | List value | AI engine |
|---|---|---|
| Between-survey interstitial impressions — 3,000,000/yr (~$22 CPM) | $66,000 | `adGridFeed` |
| Rewarded / in-survey video views — 500,000/yr (~$18 CPM) | $9,000 | `adGridFeed` |
| Homepage & category featured placement | $15,000 | `createAdGridAd` |
| Premier sponsor-wall / category-priority placement | $9,000 | `createAdGridAd` |

### B. Creative & content production — $45,000

| Deliverable | List value | AI engine |
|---|---|---|
| Managed ad-creative production (monthly refresh) | $12,000 | `aiCreativeContentGeneator` |
| Managed social ad posts — 1,200/yr | $15,000 | `autoPostContentToSocial` |
| Dedicated email campaigns to opted-in audience — 12/yr | $9,000 | `autoEmailSequenceEngine` |
| Sponsored newsletter placements — 6/yr | $9,000 | `autoEmailSequenceEngine` |

### C. Research, data & insights — $82,000

| Deliverable | List value | AI engine |
|---|---|---|
| Custom audience-panel research studies — 4/yr (real respondents) | $48,000 | `createAudiencePanel` |
| Brand-lift / ad-effectiveness studies — 2/yr (real respondents) | $12,000 | `createAudiencePanel` |
| Category & competitive insights reports — quarterly | $10,000 | `aiStrategicInsightsEngine` |
| First-party audience data feed + API access | $12,000 | `platformInsights` |

### D. Managed service, analytics & optimization — $56,400

| Deliverable | List value | AI engine |
|---|---|---|
| Always-on AI campaign manager + optimization (human escalation available) | $42,000 | `aiAdCampaignOptimizer` |
| Advanced analytics & attribution dashboard | $8,400 | `aiSurveyInsightsDashboard` |
| Multivariate / A-B testing program | $6,000 | `abTestAssigner` |

### Total

**List value $282,400 → bundled at $200,000 (≈29% bundle discount off rate card).** The list comfortably
covers the price, so even trimming the two softest lines (competitive reports, sponsored newsletters) still
clears $200k. Everything pro-rates across the 12 Tier 2 parts, so a partial buyer gets a proportional slice.

## How it serves itself

`aiAdManagerRun` (scheduled) walks every active Tier 2 advertiser, computes the deliverables due for their
progress, and dispatches each to its engine by emitting a `tier2.deliverable.due` domain event that the engine's
existing scheduler consumes. No human is in the per-advertiser loop. `aiAdManagerStatus` shows any advertiser
their rate card and exactly what has been delivered to date.

## The two constraints that still apply

- **Inventory (DAU).** The impression and real-respondent research lines are capped by your daily-active-user
  base — the AI can't serve 3,000,000 impressions or field a panel you don't have the audience for. AI removes
  the *labor* constraint, not the *audience* constraint. Gate Tier 2 availability on a DAU floor before selling.
- **Substance vs delivery.** AI legitimately automates delivery; it does not manufacture the underlying value
  (real impressions, real respondents, real optimization). Marketed results still follow the
  hypothetical-until-substantiated rule — no ROI claim until the attributed-sales data exists.
