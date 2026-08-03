# Scale-to-Amazon strategy — the four flywheels (foundations coded)

Honest framing: a survey-rewards app tops out around Swagbucks scale (~$100–200M/yr). Amazon's ~$575B comes
from **taxing others' economic activity** on rails it owns (AWS, advertising, marketplace fees) — not from
selling its own inventory. The goal here is not to promise Amazon's revenue; it's to **remove the structural
caps** so execution and capital, not architecture, decide how far this goes. Each flywheel below has a
foundation now coded into the repo so the ceiling stays open.

Your one unique asset: a **consented, highly-engaged audience that trades attention for value inside a
closed loop you control.** Every flywheel converts a thing you've already built into a platform others pay
to use.

## 1. Attention & insights platform — the "AWS" (biggest ceiling)

Advertising ≈ $700B, market research ≈ $130B — both are "someone pays to reach or learn from consumers,"
which is exactly your supply. Flip from *buying* survey inventory to being the **supply-side platform**:
brands/researchers pay you for verified attention and **aggregated, consented** insight; you take a margin.

- **Coded now:** `platformInsights` — returns **aggregate-only, consent-gated, k-anonymity** survey/audience
  insights (never individual PII; cohorts below a minimum size are suppressed). The compliant seed of the
  market-research supply business. Your AdGrid PPC campaign machinery is the advertising seed.
- **Make AdGrid a first-class product** — it's the highest-TAM, most defensible asset.

## 2. Rewards-as-a-service — the "Stripe of loyalty" (B2B2C)

License the closed-loop wallet + earning engine + anti-fraud + survey routing + marketplace so other brands
run *their* rewards/play-to-earn on your rails; you take a SaaS fee + transaction cut. Revenue scales with
*other companies'* user bases.

- **Coded now (foundation):** a `Tenant` layer (`Tenant` entity + `tenant.ts` resolver + `tenantRegistry`).
  Multi-tenancy is **impossible to retrofit** — building the seam early (even unused) keeps the door open.
  Requests resolve to a tenant (default = your own); new brands become new tenants.

## 3. Marketplace flywheel, inventory-free — the classic Amazon move, adapted

You hold **no inventory** — members can look up whatever they want and buy it anywhere. So instead of taxing
third-party sellers on a store you stock, you capture the same revenue line two ways: an **equivalent hold on
survey revenue**, and an **opt-in shopping extension** that earns affiliate commission on purchases members
make across the whole web. Your differentiator is unchanged: the closed loop means users hold Site Cash that
*must* be spent on-platform — guaranteed, capturable demand.

- **Coded now — marketplace-equivalent hold.** Rather than collect seller commission, hold back an equal
  percentage of **gross survey revenue** as the same revenue line (`marketplace-fee.ts` →
  `applyMarketplaceEquivHold`, `MARKETPLACE_EQUIV_HOLD_*` settings, applied in `computeSurveyReward` before
  the user share). It’s an **additional** hold on gross, so it slightly lowers the user pool — **disclosed**
  in Terms and on the earn-rate page. The original seller-commission config (`sellerSaleSplit`) stays, unused,
  in case you ever do stock a store.
- **Coded now — opt-in shopping extension (Honey-style), backend + consent.** `shopping.ts` +
  `shoppingConsent` + `shoppingPurchaseIngest` + `AffiliatePurchase` entity + `SHOPPING_*` settings. With the
  user’s explicit in-app consent, the (separately-shipped) extension applies discounts wherever they shop and
  posts each purchase; a configurable share of the affiliate commission returns to the user as closed-loop
  Site Cash, the rest is your revenue. **Data-minimized** (merchant, order total, commission only) and
  **consent-gated**; shipping needs affiliate partnerships + Chrome Web Store review + a privacy review.
- **Your addition — mandatory 30-second ad between surveys (non-premium).** Coded: `surveyInterstitialGate`
  + `SurveyInterstitialAd.jsx` + `SURVEY_INTERSTITIAL_*` settings, wired into the live survey-start flow.
  Non-premium users watch a 30s ad between surveys (premium exempt — an upgrade lever); the ad is your own
  AdGrid/sponsored inventory, so it feeds flywheel #1's ad revenue.

## 4. Cost leverage — the enabler (already built)

Platforms die from unit economics before demand. The provider/self-host layer + advisor keeps AI/media/infra
near $0 at launch and bounded at scale — what lets the three revenue flywheels survive to hundreds of
millions of users.

## All four, offered as Services on the website

Each flywheel is now presented publicly as a **service** on a `/Services` marketing page (`src/pages/Services.jsx`):
consented audience insights, rewards-as-a-service, marketplace/ad reach, and cost-leverage — plus the opt-in
shopping helper. Marketing-only (a partnerships contact email, no lead form/backend), each card labels what’s
live vs. a foundation. This makes the platform’s B2B offer legible to brands, sellers, and partners the moment
they land, instead of it living only in strategy docs.

## The one-sentence strategy

Stop being a rewards app that sells things; become the platform that other people's **attention, rewards
programs, and commerce** all run on — with the **advertising/attention business as the center of gravity**,
the only asset here with a ceiling in the hundreds of billions.

## Compliance reality (holds)

The two biggest-TAM flywheels (insights, advertising) are the most regulated. The closed-loop/non-cashable
model keeps you out of money transmission; the data business only scales *legally* with airtight consent +
privacy from day one. `platformInsights` is aggregate-only + consent-gated + k-anonymity by design for
exactly this reason.

## Foundation vs finished business

These are **seams and scaffolds**, not finished platforms — each revenue flywheel is a multi-year build.
What's coded keeps the architecture from capping you: the tenant seam, the aggregate-only insights endpoint,
the marketplace-fee model, and the interstitial-ad → own-inventory loop. Build each out as demand appears.
