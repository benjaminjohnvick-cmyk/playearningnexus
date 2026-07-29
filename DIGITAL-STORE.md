# Digital Products store

A "Digital Products" section mirroring the Physical Items store, for intangible goods delivered **online
instantly** — no shipping, no local pickup. Same parity and constraints as physical, with two deliberate
differences.

## Same as the physical store

- **Serverless-GPU category tile**: "Digital Products" is a department in `taxonomy.ts`, so
  `aiCategoryImages` generates its tile (and its subcategory tiles) exactly like every other category.
- **Full parity**: search, sort, localized pricing, listing grid.
- **Payment**: Credit card (default, +10% markup) · Points/surveys-only (marked-up points shown) ·
  Layaway (reserve & pay it down with points, then it unlocks — ≤ `LAYAWAY_MAX_MONTHLY_USD`/mo).
- **Promotional (welcome) credit** applied per the same rules (markup-funded, margin-positive).
- **Affordability warning** over `PHYSICAL_AFFORDABILITY_LIMIT_USD` ($1,460), and the **Purchase Payback**
  earn-back tracker.

## Sort control + one-click Buy now

Same as the physical store: an Amazon-style **sort dropdown** at the top of the results (Featured, Price
↑/↓, Avg. Customer Review, Newest, Best Sellers) via the shared `src/lib/storeSort.js`, plus the one-click
**⚡ Buy now** button that logs the order and then prompts to complete it (nothing charged until confirmed +
card on file). See `STORE-SORT-AND-ONE-CLICK.md`. Teen orders route to the adult holder for approval (see
`HOUSEHOLD-TEEN-ACCOUNTS.md`).

## Two deliberate differences

- **Online delivery only** — there is no local-pickup option; a paid digital order is marked `delivered`
  immediately with `fulfillment_type: "digital_delivery"`.
- **No Affirm BNPL** — financing is restricted to real, shippable goods (the Affirm guardrail already
  hard-blocks digital/points/credit), so the Digital store never offers BNPL.

## How items are separated

A listing is digital when its `product_type` is `"digital"`, its `fulfillment_mode` is `"digital"`, or
its category is in `DIGITAL_CATEGORIES` (`catalog.ts`, kept in sync with the taxonomy department). The
Digital store shows **only** those; the Physical store **excludes** them. `physicalStoreConfig` returns
`digital_categories` so both pages filter consistently. `createMarketplaceListing` accepts
`product_type: "digital"` (with an optional `digital_delivery` payload) for member/creator digital
listings; the catalog seeder populates the digital taxonomy categories with original AI products +
serverless-GPU tiles like everything else.

## Controls

Flag `digital_store` (default on). Reuses the physical store's settings (`STORE_MARKUP`,
`PHYSICAL_AFFORDABILITY_LIMIT_USD`, `LAYAWAY_MAX_MONTHLY_USD`, `PROMO_FUNDED_BY_MARKUP`). Nav entry +
Marketplace banner. `DigitalStore` page auto-routes.
