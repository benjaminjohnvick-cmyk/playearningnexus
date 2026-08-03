# Shopping extension, marketplace-equivalent hold & Services page

Three changes that extend the scale flywheels (see SCALE-TO-AMAZON-STRATEGY.md), built to the same standard:
foundations and seams that keep the ceiling open, with the compliance line held.

## 1. All four flywheels are offered as Services (public page)

`src/pages/Services.jsx` (route `/Services`, wired in `App.jsx`) presents the four flywheels as B2B services —
Consented Audience Insights, Rewards-as-a-Service, Marketplace & Ads, and Cost Leverage — plus the opt-in
shopping helper. It is **marketing-only**: a partnerships contact email is the call to action, with **no lead
form and no backend**. Each card labels what is live today versus a foundation. Replace the placeholder
`partnerships@gamergain.example` with your real inbox before launch.

## 2. Marketplace-equivalent hold on survey revenue (flywheel #3, inventory-free)

You hold no inventory, so there are no third-party seller commissions to collect. Instead the platform holds
back an **equal percentage of gross survey revenue** as the same revenue line.

- **Where:** `marketplace-fee.ts` → `applyMarketplaceEquivHold(grossUsd)`; applied in
  `survey-reward.ts` → `computeSurveyReward` **before** the user share is computed, so the share is taken on the
  net-of-hold gross.
- **Settings:** `MARKETPLACE_EQUIV_HOLD_ENABLED` (default on) and `MARKETPLACE_EQUIV_HOLD_PCT` (default `0.12`,
  mirroring the seller-commission rate).
- **Disclosure:** this is an **additional** hold on gross, so it slightly lowers the user earn pool. It must be
  disclosed in the Terms and on the earn-rate page. Turn the flag off to leave survey earnings untouched.
- The original seller-commission helper (`sellerSaleSplit`) is left in place, unused, in case you ever stock a
  real store.

## 3. Opt-in shopping extension (Honey-style) — backend + consent only

An optional browser extension (shipped separately) that, **with the user’s explicit consent**, applies
discounts wherever they shop online and turns purchases into closed-loop Site Cash. What’s coded now is the
**app side** so the platform is ready when an affiliate partner is chosen:

- **`shopping.ts`** — economics + consent helpers: `cashbackSplit` (share of affiliate commission → user Site
  Cash vs. platform revenue), `estimateCommission`, and the `SHOPPING_*` settings accessors.
- **`shoppingConsent`** (function) — the explicit opt-in gate. `status` / `grant` / `revoke`, recorded in the
  existing append-only `ConsentRecord` ledger (kind `shopping_tracking`) via `consent-ledger.ts`. Includes the
  plain-language disclosure shown to the user.
- **`shoppingPurchaseIngest`** (function) — records one observed purchase and credits the user’s cashback share
  as Site Cash. **Refuses** unless the feature is enabled and (when `SHOPPING_CONSENT_REQUIRED` is on) the user
  has a current consent. Enforces `SHOPPING_DAILY_CASHBACK_CAP_USD`.
- **`AffiliatePurchase`** (entity) — data-minimized record: merchant, order total, commission, cashback,
  network, a coarse ref/day. **Never** full carts, item lists, card data, or browsing history.
- **Settings:** `SHOPPING_EXT_ENABLED`, `SHOPPING_CONSENT_REQUIRED`, `SHOPPING_CASHBACK_PCT`,
  `SHOPPING_DAILY_CASHBACK_CAP_USD`.

### Before it can ship (out of scope for the code, on purpose)
- **Affiliate-network partnerships** (e.g. an affiliate aggregator) — the extension earns commission through
  these; without them there is nothing to share back.
- **Chrome Web Store review** — extensions that read purchase pages face strict single-purpose and
  data-disclosure rules; the listing needs an accurate privacy disclosure.
- **A dedicated privacy review + policy update** — this feature sees purchase data, so it needs its own clause
  in the Privacy Policy, a clear consent screen, data-retention limits, and an easy off switch. The consent
  record, data minimization, and revoke path are built for exactly this.
- **Reputational note:** the well-known incumbent in this space drew criticism for how it attributed affiliate
  commissions and for not always surfacing the best available discount. Decide your attribution and
  best-price policy deliberately and state it plainly.

## Compliance line (holds)

Cashback is **closed-loop Site Cash**, never a cash payout — same non-cashable model as the rest of the
platform, so this stays out of money-transmission territory. The insights service remains aggregate-only +
consent-gated + k-anonymous. The shopping feature is strictly opt-in, consent-gated, and data-minimized.
Consent is always the user’s, recorded in-app — never inferred from the extension, a web page, or a tool.
