# Product Stats — statistical data on anything sold

*Collects real results for every product and publishes them only when the data supports it. Same discipline as
the AI-funnel benchmarks: real orders, adequate sample, basis attached, never fabricated. Not legal advice.*

## What it does

`productStatsCompile` (scheduled daily) reads every **Order** and aggregates it **per product**:

- **units / orders**, **distinct buyers**
- **typical order** value — the **median** (default) or average amount paid
- **total revenue** and **average order value**

Each product gets one `ProductStat` row, refreshed daily. A product is marked **published** once it has at
least `PRODUCT_STATS_MIN_SAMPLE` counted orders (default 30). Cancelled/refunded/unpaid orders are excluded
(`PRODUCT_STATS_EXCLUDED_STATUSES`).

## "How it works" vs "the results"

This is the compliance spine, generalized to the whole catalog:

- **Below the sample threshold** → the product is **"gathering data."** The site should show **how it works**
  (a description / hypothetical), **not** a typical-result claim.
- **At/above the threshold** → the product **publishes real results** with a self-describing **basis**
  ("median of N orders from M buyers, as of DATE") and the `PRODUCT_STATS_DISCLAIMER` ("real orders to date,
  individual results vary, not a guarantee").

`productStatView()` returns exactly this: a `results` view when published, else a `gathering` view. So a
"typical" figure is only ever shown for a product once enough real orders back it — never invented.

## Feeding the AI + showing it on-site

- `productStats` (read) returns the compiled stats for one product (`{ item }`) or the published set. It's safe
  to show buyers and to feed the AI concierge, which can use a product's real results when recommending it (and
  fall back to "how it works" when a product is still gathering data).
- Admin page **`/ProductResults`** lists every tracked product with its typical order, orders, buyers, revenue,
  and published/gathering status.

## Settings (category "Product Stats")

`PRODUCT_STATS_ENABLED`, `PRODUCT_STATS_MIN_SAMPLE` (30), `PRODUCT_STATS_METHOD` (median/average),
`PRODUCT_STATS_SOURCE_ENTITY` (Order), `PRODUCT_STATS_ITEM_FIELD` (product_name), `PRODUCT_STATS_AMOUNT_FIELD`
(amount), `PRODUCT_STATS_STATUS_FIELD` (status), `PRODUCT_STATS_EXCLUDED_STATUSES`, `PRODUCT_STATS_DISCLAIMER`.

## Where it lives in code

- Model: `backend/sdk/product-stats.ts` — `computeProductStats`, `productStatView`.
- Entity: `ProductStat` (global) — one row per product.
- Functions: `productStatsCompile` (scheduled), `productStats` (read).
- Schedule: `product-stats-compile-daily` in `backend/scheduler/schedules.json`.
- Page: `/ProductResults`.

Run `productStatsCompile` with `{ "dry_run": true }` to preview what would publish without writing.
