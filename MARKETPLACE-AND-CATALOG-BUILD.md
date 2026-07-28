# Marketplace, AI Catalog, i18n & Data — Build Reference (current)

What the marketplace / AI-catalog system does today and how to run it. All original content or
authorized-affiliate only — no retailer catalog is copied.

## Marketplace (Facebook-style)
- Buy with **points** (closed loop, 1 pt = 1¢ in the local currency) or **card** (+10% markup).
- Purchases branch on `listing.source`: `platform_catalog` (platform sells, AI fulfillment),
  `user` (member sells/ships, AI-managed escrow), `affiliate` (retailer sells; we return the link).
- **Card orders don't fulfill until payment is captured** (no giveaway if card charging is switched on
  before a processor is wired).
- Members can **relist owned items with no personal info** (`relistItem`, seller shows as "GamerGain
  Member"). Third-party sellers post via `createMarketplaceListing` / the third-party seller page.
- Grid has search + sort (price/newest) + category filter.

## AI Catalog — template-once, clone-per-country
- `aiCatalogSeed` builds a country-agnostic **template** set of original products across the taxonomy,
  generating each **image once** on the serverless GPU, then **clones** templates into every country in
  `CATALOG_COUNTRIES` — same base image, **localized price** (points = 1¢ local) and country context.
- Populates per country first; then third-party sellers add listings.

## Taxonomy — exceeds a large retailer
- `taxonomy.ts`: **40 departments → 905 subcategories → ~21,700 AI browse nodes** (`aiBrowseNodeExpand`
  generates ~24 original browse nodes per subcategory). `getTaxonomy` powers the **Categories** page:
  department → subcategory → browse node → "find the real thing" product search.
- `aiCategoryImages` spins up original category tile images on the serverless GPU, once each.

## "Find the real thing" search
- Aggregated, sortable search across **Amazon, Google Shopping, eBay, and the country's largest local
  retailer** (Rakuten/Flipkart/Mercado Livre/Otto/Walmart/…). Amazon carries your affiliate tag when
  configured (FTC-disclosed). Full-screen AI search bar with sort + price filters + in-catalog matches.

## Serverless GPU images (AWS)
- `IMAGE_PROVIDER=aws_bedrock` (zero infra, pay-per-image) or `aws_sagemaker` (your SDXL/FLUX endpoint,
  scale-to-zero). Kill switch `CATALOG_IMAGES_ENABLED`, per-run cap `CATALOG_IMAGES_MAX_PER_RUN`.
- See `backend/.env.example` and `COST-AND-DEVHOURS-LEVERS.md` for setup + cost control.

## Internationalization
- **88 country markets** (currency, language, flag, FX, top retailer) in `catalog.ts`; **56 currencies
  and 24 languages** in the frontend locale system. Currency conversion + translation apply site-wide,
  including marketplace prices.
- **Country auto-detected by geo-IP** (`LocaleContext`): the **top banner flag** and (unless the user
  chose otherwise) currency + language follow the user's real country. Cached 24 h with a browser-locale
  fallback.

## Data collection & the self-improving Claude model
- Global click/event capture (`uxTracker.js`) + survey-honesty analysis feed behavioral entities.
- `site-model.ts` compiles a living context the model reads; `optimizer.ts` proposes changes;
  `experiments.ts` A/B-tests them with customers before non-sensitive ones auto-apply and sensitive
  ones require admin approval. Per-user profiles drive recommendations + the assistant chatbot.
- Users can opt out of recording, export their data, and delete their account.

## Turn it on (admin → Platform Settings, or env)
- `CATALOG_COUNTRIES` (start with `US`), `IMAGE_PROVIDER`, `AI_DAILY_SPEND_CAP_USD`,
  `CATALOG_LISTINGS_PER_COUNTRY` (start ~80), optional Amazon Associate credentials.
- Scheduled jobs: `daily-catalog-seed`, `daily-category-images`, `daily-browse-node-expand`.

## Guardrails that stay on
- Age 18+, tax thresholds, points non-cashable until cash-out is enabled, card charging off until a
  processor is wired, prohibited-item blocking, compliance keys excluded from AI optimization.
