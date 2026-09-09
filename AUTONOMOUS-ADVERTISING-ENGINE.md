# Autonomous Advertising Engine — Design & Build

*One closed-loop, autopilot marketing engine — the "Auto SEO AI" pattern generalized from organic SEO to every
advertising surface — built on the autonomy kernel, model router, and gate that already exist. Current as of
2026-09-09. Not legal or financial advice.*

---

## The idea

"Auto SEO AI" is a continuous loop: **discover → brief/generate → deploy → track → iterate**, with a human
approval gate on anything that publishes or spends. Generalized to advertising, ONE engine runs that loop over
every ad surface:

1. **Discover** — opportunities per surface: keyword/answer-engine gaps (`seo.ts`), audience/targeting openings
   (`ad-targeting-ai`, `adTargetingLearn`), campaign/slot inefficiencies (`aiAdDiscovery`, `adGrid*`),
   underperforming creatives.
2. **Generate** — assets: SEO content/metadata (built), **ad copy + creative** (`creative-suite`), and **landing
   pages** (the main net-new piece).
3. **Deploy** — schedule + place: on-platform slots (`adGrid`), house ads, and — if pushed off-platform — Google
   Ads / Meta via their APIs.
4. **Track** — one shared signal bus: impressions, clicks, conversions, spend, ROAS, rankings, AI citations, and
   now **Interested / Buy Now engagement** (this build).
5. **Iterate** — the optimizer (`aiAdCampaignOptimizer`, `ad-learning`) re-allocates budget and re-briefs the
   next round. The closed loop is what makes it "auto."

We are **not** starting from zero: the autonomy kernel already defines `ad_optimization`, `creative`, `content`,
`content_calendar`, `seo_metadata`, `pricing_experiment`, `analytics_report`, `recommendation`, `matching`,
`social`; and the SDK/functions already include `creative-suite`, `ad-targeting-ai`, `aiAdCampaignOptimizer`,
`aiAdDiscovery`, `ad-learning`, the `adGrid*` auction system, and advertiser reporting. The work is **unifying
these into the continuous loop**, extending autonomy per surface, and adding the missing inputs (a
keyword/audience-demand source, external ad-platform APIs) and outputs (landing pages).

## Two actors — the hard line

- **Your own advertising** (house ads, your paid acquisition, organic SEO): you own the claims, budget, and
  liability. Autopilot here is your call.
- **Advertisers' campaigns on your platform**: the engine would generate creative, optimize targeting, and move
  *their* budget on *their* behalf. This requires **explicit per-campaign opt-in, hard spend caps, a
  kill-switch, and an audit trail** — it cannot inherit the same autonomy dial as your house ads.

## Autonomy + the compliance gate

Each surface graduates through the existing gate (`gateAndRun` + overseer) like `seo_metadata` does — register
per-surface domains (`ad_copy`, `ad_creative`, `landing_page`, `ad_budget`, `seo_content`) that each earn
autonomy independently. A single **compliance-review gate** sits permanently in front of anything that **makes a
claim** (earnings, guarantees, rewards amounts) or **spends money**. Ad compliance is far heavier than SEO:
FTC truth-in-advertising, and "earn money / get-paid-to" offers draw the heaviest scrutiny on Google/Meta
(account-suspension risk). Recommended ceiling: content + house ads graduate first; advertiser campaign
optimization next (opt-in + caps); external paid media last; **claims and spend stay human-gated regardless**.

## Phased rollout (by risk)

1. **SEO content + house ads + advertiser self-service assist** — low money/claim risk. (SEO layer already built.)
2. **On-platform advertiser campaign auto-optimization** — with opt-in, spend caps, kill-switch.
3. **External paid media (Google/Meta)** — highest policy + credential risk.

---

## Engagement signals — the two ad buttons (BUILT)

Every advertisement now carries two buttons, giving the loop its mid- and bottom-funnel signals.

### Behavior
- **Buy Now** → records a `buy_now` signal, then routes to the purchase step: an **outbound advertiser link**
  when the product has one, else **on-platform checkout** (`/store?buy=…`). *Decision still open: default
  destination per ad type.*
- **Interested** → **toggles the product into the viewer's favorites** (`ProductWishlistItem`, reused), so the
  viewer instantly joins every re-engagement flow that entity already drives (price-drop alerts, cart nudges,
  AI suggestions). Toggling again un-favorites it. Logged-out viewers get a sign-in prompt (a growth hook).

### Reuse, not reinvention
- **Favorites** = the existing `ProductWishlistItem` + its engine (`wishlistGet`, `addWishlistProducts`,
  `autoWishlistPriceDropMonitor`, `autoWishlistCartSuggestion`, `wishlistAISuggest`).
- **Tracking** = the existing `events.ts` bus (`emitEvent`) + `advertiser-metrics.ts`.

### Event / fraud / billing wiring
- Each signal is stored as an **`AdEngagement`** row (user, kind, ad, campaign, advertiser, category, placement,
  timestamp) for advertiser stats, and emitted as a **`ad.engagement.{kind}` DomainEvent** so the `ad-learning` /
  optimizer agents react — that is the "AI tracking."
- **Anti-fraud**: duplicate clicks by the same user on the same ad+kind within a 60s window are de-duped — not
  double-counted, not double-billed. (Hooks into the broader ad-fraud/risk system for bot filtering.)
- **Billing**: MEASURED-ONLY by default. `AD_ENGAGEMENT_BILLABLE` (+ `AD_ENGAGEMENT_CPE_USD`) turns on a fixed
  cost-per-engagement, written as an **`AdTransaction` ledger entry only** — never a balance mutation — so the
  existing billing sweep reconciles it. *Decision still open: billable vs measured-only.*

### Advertiser-facing stats (with privacy guardrail)
`adEngagementStats` returns, for the calling advertiser's own ads: Interested count + rate, Buy Now count + rate,
interest→purchase conversion, per-ad breakdown, and a plain-language insight (e.g., *"strong interest but few Buy
Now — likely price or checkout friction"*). **Only aggregate counts and rates are exposed — never the identities
of the users behind them.** Interested users are a warm audience the advertiser can act on **through on-platform
retargeting**, not by receiving a user list.

### AI ad optimization — show users what they'll want
`adEngagementRank` ranks candidate ads per user by how likely they are to be **Interested in / want to Buy** them.
A transparent, explainable blend: the user's **affinity** (categories/brands they've favorited or bought, with
Buy Now weighted 3× Interested) × each ad's **proven pull** (relative Interested/Buy Now popularity). New users
cold-start to the strongest ads. It feeds the same loop the optimizer runs. (A model-router upgrade can replace
the heuristic later; the deterministic version is free and never fabricates.)

### Files (this build)
- **New:** `backend/sdk/ad-engagement.ts` (pure: kinds, flags, rate math, insight, affinity ranker) +
  `ad-engagement.test.ts`; `backend/functions/adEngagementRecord/`, `adEngagementStats/`, `adEngagementRank/`;
  `src/components/ads/AdActionBar.jsx` (the reusable two-button bar).
- **Changed:** `backend/db/schema.sql` + `backend/db/entities.json` (`AdEngagement`),
  `backend/functions/_manifest.json` (3 functions), `src/components/ads/AdDiscoveryCard.jsx` (drops in the bar).
- **Drop-in for the rest:** `<AdActionBar ad={…} placement="…" compact={…} />` mounts on every other ad surface
  (SponsoredListingsPanel, MarketplaceProductCard sponsored, adGrid feed, interstitials) — identical pattern.

### Settings (safe fallbacks; can be promoted to registered admin settings)
`AD_ENGAGEMENT_ENABLED` (on), `AD_INTERESTED_BUTTON_ENABLED` (on), `AD_BUY_NOW_BUTTON_ENABLED` (on),
`AD_ENGAGEMENT_BILLABLE` (off), `AD_ENGAGEMENT_CPE_USD` (0).

## Open decisions

1. **Buy Now destination** — on-platform purchase, outbound advertiser link, or per-ad-type.
2. **Billable vs measured-only** — charge engagement as CPE, or report only.
3. **Advertiser visibility depth** — pure aggregates vs. anonymized cohort/warm-audience insights.
4. **Guest behavior for Interested** — sign-up prompt (recommended) vs. ephemeral favorite.
5. **First surfaces + spend-authority model** for the broader engine (per "Phased rollout").

## Related
- `AI-SEO-AND-SEARCH-OPTIMIZATION.md` — the organic-search half of the loop.
- `AUTONOMY-GATING-AND-OVERSIGHT.md` — the gate + coverage model this graduates through.
- `AI-MODEL-MODULE-AND-AUTONOMY-MAP.md` — the model router the generate/rank steps can plug into.

*Not legal or financial advice — auto-generated ad copy optimizes wording only and never fabricates claims,
prices, or guarantees; autonomous budget actions require spend caps, disclosure, and (for advertisers) their
authorization.*
