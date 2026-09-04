# Revenue-Streams Expansion — Build Map & Governance

*Prepared 2026-09-04. This is the build/governance map for the "add more revenue streams" work. It answers
the request "build all 8 categories and sub-points the way we've built everything else — gated, compliant,
wired into the flywheel." It is written honestly: it marks each stream **BUILT** (code-complete and wired),
**GATED** (real settings/scaffold in place, safe-OFF, needs a third-party account/key before it can earn),
or **COUNSEL** (deliberately not built until an attorney signs off). **Not legal advice.***

---

## The one rule every stream obeys

The customer never pays a markup, and every earned dollar is written to ONE ledger (`RevenueEvent` via
`recordRevenue()`), so the business side can be proven to out-earn any retired markup. Users only ever
receive **non-cashable, closed-loop Site Cash**; only **businesses/sellers/advertisers** are paid real money.
Anything that would move real money *to a user*, create a cash-equivalent, or transmit money is either
already gated OFF behind KYC or is on the **COUNSEL** list below. This is what keeps the expansion inside
the existing closed-loop / non-money-transmission / FTC-safe lines.

---

## What shipped in this pass (NEW, code-complete)

### Category 4 — three closed-loop sub-points built this pass ✅

Beyond the cosmetics store (below), two more category-4 sub-points shipped fully, and a governance registry was
added so **every sub-point of all 8 categories** is enumerated and status-tracked:

- **Site-Cash gifting-with-fee** ✅ BUILT — a user gifts non-cashable Site Cash to another user; store credit
  moves *between accounts* (never money, never a cash-out), and the platform keeps a small closed-loop spread
  booked as `breakage`. Sender sees fee + net before confirming; atomic debit with full refund if delivery
  fails; min/max caps. Settings `SITE_CASH_GIFTING_*`. Function `giftSiteCash`. Entity `SiteCashGift`.
- **Earn boosts** ✅ BUILT — a user spends Site Cash on a **deterministic**, time-limited earn multiplier
  (fixed multiplier, fixed window, known price — **not** a random/paid draw, so not a loot box, not gambling).
  The purchase is a closed-loop sink (`breakage`); the boost scales only **non-cashable** Site-Cash earnings
  and is **wired into the live earning path** (`adGridAnswer`). Settings `EARN_BOOST_*`. Functions
  `purchaseEarnBoost`, `siteCashPerksStatus`. Entity `EarnBoost`. User page `SiteCashExtras.jsx`.
- **Revenue-Levers registry** ✅ BUILT — `backend/sdk/revenue-levers.ts` enumerates **every sub-point of all 8
  categories** with its status (built/gated/counsel), ledger type, gate, and (for gated) what external account
  it still needs. Admin function `revenueLeversStatus` + admin page `RevenueLevers.jsx` show it live, with real
  earnings per ledger type. Setting `REVENUE_LEVERS_REGISTRY_ENABLED`. Entity `RevenueLever`.
- **Season / battle pass** — roadmap (the cosmetics store is the reference build); not shipped this pass.

### Category 4 flagship — Closed-loop cosmetics store ✅ BUILT
A pure on-platform virtual-goods store. Users spend Site Cash on avatar frames, profile themes, badge flair,
nameplates, and profile effects. **No real-money purchase, no cash value, non-tradeable, not a loot box (no
randomized paid draws) — so it's not gambling and not money transmission.** Economically it's a **Site-Cash
sink** that recaptures outstanding store-credit liability as margin, booked as `breakage` revenue, and speeds
the flywheel (users return to earn Site Cash to spend on cosmetics).

- **Settings:** `COSMETICS_ENABLED` (default ON; non-sensitive — it moves no real money and creates no
  cash-out path, so it's a normal feature toggle, not a counsel-gated flag).
- **Data:** `CosmeticItem` (admin-curated catalog) + `UserCosmetic` (ownership + equipped-per-type).
- **SDK:** `backend/sdk/cosmetics.ts` — `cosmeticsEnabled()`, the 10-item starter catalog, normalizers.
- **Functions:** `cosmeticsCatalog` (read: catalog + owned + equipped + balance), `purchaseCosmetic`
  (**atomic** Site-Cash debit via `adjustUserBalance`/`db.updateIf`; fails on insufficient funds, never floors;
  refunds if the grant write fails; books `breakage`), `equipCosmetic` (one active per type),
  `adminCosmeticUpsert` (admin catalog curation).
- **Frontend:** `src/pages/CosmeticsStore.jsx` — store grid with buy/equip, live Site-Cash balance, and a
  plain-English "no cash value / can't be sold or transferred / can't be redeemed for money" disclosure.
- **Compliance:** closed-loop only; the disclosure is on-page; not a loot box (fixed price, known item, no
  randomized paid mechanic); non-cashable both directions. **Buildable and shipped in full.**

---

## The 8 categories — full map

Legend: **BUILT** = live & wired · **GATED** = scaffold/settings present, safe-OFF, needs your third-party
account before it earns · **COUNSEL** = not built pending attorney sign-off.

### 1. Deepen advertising (the hub)
- Sponsored placement / ad slots — **BUILT** (`sponsored_placement`, `SPONSORED_PLACEMENT_PRICE_USD`).
- Advertiser PPC grid + auto-renew + SCA/3DS — **BUILT** (`processPPCGridSubscription`, `stripeWebhook`).
- Sponsored surveys/quizzes, homepage takeovers, sponsored jackpots — **BUILT** (`sponsored_prize`, AdGrid).
- **Offerwall / CPA wall, rewarded video, sponsored push/email** — **GATED.** These require a connected ad
  network (e.g. an offerwall/rewarded-video SDK + your publisher account). Recorded as `advertising` when
  live; nothing bills until you connect the network and enable it. *No fabricated integration is shipped.*

### 2. Commerce
- Marketplace seller commission / cash-back margin — **BUILT** (`seller_commission`, `marketplaceMarginSource`).
- Sourcing/wholesale spread on catalog fulfillment — **BUILT** (`sourcing_margin`, `catalogWholesaleFraction`).
- Curator resale reward (user resells a catalog item, platform keeps the spread) — **BUILT** (`curator_reward`).
- Seller listing/promo fees — **BUILT** (`business_signup`/`business_onboarding` rails).
- **Affiliate storefront, print-on-demand, group-buying** — **GATED.** Each needs a third-party account
  (affiliate network, POD supplier API, group-buy supplier). `affiliate_commission` is already a ledger type;
  the earn switches on when you connect the account.

### 3. Subscriptions
- Premium membership (+ compliant auto-renew, advance + 24h final notice) — **BUILT** (`membership_fee`).
- B2B SaaS tiers (basic/pro/enterprise) — **BUILT** (`saasTierPriceUsd`, `business_subscription`).
- Paid ad-free / boosts, family plan, Pro tools — **GATED** (price knobs safe-OFF; enable per tier when priced).

### 4. Closed-loop virtual economy
- **Cosmetics store — BUILT this pass** (above).
- Site-Cash boosts, season/battle pass, gifting-with-fee — **GATED/roadmap.** All are closed-loop and fully
  buildable next; each is a Site-Cash sink that books `breakage`. Not shipped in this pass to keep the change
  reviewable; the cosmetics store is the reference implementation for all of them.

### 5. Data / B2B insights
- Audience panels / targeted survey campaigns — **BUILT** (`audience_panel`, `AUDIENCE_PANEL_PRICE_USD`).
- Insights reports, brand-lift panels, product testing — **BUILT/GATED** (advertiser reports exist;
  packaged report SKUs are a pricing switch).
- API access, AI-creative-as-a-service — **GATED** (`white_label` ledger type + dev/creator cut exist; meter
  + key issuance turn on when you decide to sell it).

### 6. Performance / lead-gen
- Lead/referral fee to businesses — **BUILT** (`lead_fee`, `computeLeadFee`).
- Survey-routing arbitrage — **BUILT/GATED** (`arbitrage_margin` ledger type; needs a partner router).
- **Financial lead-gen** — **COUNSEL** (see below).

### 7. Platform
- White-label / RaaS, hosting — **BUILT/GATED** (`white_label` ledger type; per-tenant provisioning is a build
  step, priced OFF until you sell a tenant).
- Fraud-as-a-service — **GATED** (internal fraud tooling exists; externalizing it is a productization step).

### 8. Fees (structural, never a customer markup)
- Processing rebate share — **BUILT** (`processing_rebate`).
- BNPL merchant fee — **BUILT** (`bnpl_merchant_fee`).
- Shipping spread — **BUILT** (`shipping_margin`).
- Expedited-fulfillment fee, partner payout fee — **GATED** (price knobs OFF).
- **FX spread** — **COUNSEL-adjacent** (only relevant once real-money cross-border flows exist; keep OFF).

---

## Every gated & counsel lever is now a Setup-Wizard step (gated OFF)

Each GATED (external-account) and COUNSEL (lawyer-first) sub-point now has a **real, sensitive, default-OFF
`*_ENABLED` flag** in the settings registry. Because the wizard control (`counselFeatureGate`) derives its list
from *every sensitive boolean that defaults OFF*, all of these **appear in the Setup Wizard automatically** as
pending steps, each with help text stating exactly what account or counsel approval it needs. Enabling a flag
is safe — it only unlocks the path; nothing earns until the named account is connected (gated) or the mechanism
is built (counsel placeholders). The flags are read by `revenue-levers.ts` (`leverConfiguredOn`) so the admin
Revenue-Levers page marks any you've switched on as **"On · awaiting"**.

- **Gated (operational confirm to enable):** `OFFERWALL_CPA_ENABLED`, `REWARDED_VIDEO_ENABLED`,
  `SPONSORED_PUSH_EMAIL_ENABLED`, `AFFILIATE_STOREFRONT_ENABLED`, `PRINT_ON_DEMAND_ENABLED`,
  `GROUP_BUYING_ENABLED`, `FAMILY_PLAN_ENABLED`, `PRO_TOOLS_ENABLED`, `SEASON_PASS_ENABLED`,
  `PRODUCT_TESTING_PANEL_ENABLED`, `API_ACCESS_ENABLED`, `AI_CREATIVE_SAAS_ENABLED`,
  `SURVEY_ROUTING_ARBITRAGE_ENABLED`, `HOSTING_MONETIZATION_ENABLED`, `FRAUD_SAAS_ENABLED`,
  `EXPEDITED_FULFILLMENT_ENABLED`, `PARTNER_PAYOUT_FEE_ENABLED` (white-label RaaS is the existing
  `MULTITENANCY_ENABLED`).
- **Counsel (require `confirm:"COUNSEL_APPROVED"` — added to `LEGAL_BRIEFS`):**
  `FINANCIAL_LEAD_GEN_ENABLED`, `FX_SPREAD_ENABLED`, `CRYPTO_PAYMENTS_ENABLED`, `NFT_MARKETPLACE_ENABLED`.
  The last two (and FX) are **governance placeholders with NO mechanism built** — the flag alone does nothing;
  a dedicated, counsel-cleared build is required before they could ever earn. The existing user cash-out rails
  (`POINTS_CASHABLE`, `PAYPAL_AUTOSETTLE_ENABLED`) remain the gated + counsel money paths — no new cash-out
  mechanism was added.

---

## Deliberately NOT built (the guardrail list)

These were on the brainstorm but are **out of model** or **counsel-only**, and were **not** built:

- **Crypto / NFTs / tokenized anything** — introduces money-transmission, securities, and custody exposure;
  breaks the closed loop. Not built.
- **Cash-value loot boxes / randomized paid draws** — gambling exposure; the cosmetics store is deliberately
  fixed-price, known-item (not a loot box). Not built.
- **Any user cash-out / interchange / branded debit card / earned-wage advance** — real-money-to-user rails
  are already gated behind KYC/1099 and stay OFF; new cash-out mechanics are **COUNSEL**-only.
- **Financial lead-gen (loans/credit/insurance referrals)** — regulated (licensing, UDAAP, state lending
  law); **COUNSEL** before any build.

*Rationale: every item above would either move real money to a user, create a cash-equivalent, or invite a
regulated-activity classification. Building them "gated OFF" still ships the mechanism; for these the correct
posture is to not ship the mechanism until counsel clears the specific structure.*

---

## For your attorney (what to review before flipping any GATED stream ON)

1. **Cosmetics store** — confirm the "no cash value / non-tradeable / not a loot box" characterization holds
   in your target markets, and that fixed-price known-item virtual goods aren't a regulated instrument anywhere
   you launch. (Low risk by design; flagged for completeness.)
2. **Offerwall / rewarded video** — network terms, disclosure, and that rewards remain closed-loop Site Cash.
3. **Affiliate storefront / POD** — seller-of-record and tax questions carry over from the fulfillment brief.
4. **API access / white-label** — data-processing terms, DPA, and what customer data a tenant may touch.
5. The **guardrail list** items — do not build until cleared.

*None of this is legal clearance. Get your attorney's sign-off before enabling revenue streams in a market.*
