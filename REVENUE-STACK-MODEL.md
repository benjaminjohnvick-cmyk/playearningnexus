# Revenue Stack Model — the blended $200k/year, over 5 years, per customer

*Reporting & planning layer. It measures money already recorded against the owner's target — it never bills a
customer, moves money, or promises a return. Not legal advice.*

## The idea

$200,000/year is a **stack**, not a single product: the sum of every business-funded revenue line the
platform already records to the unified `RevenueEvent` ledger. PPC advertising is **one line** in that stack —
its advertiser LTV stays **$12,000** (`FOUNDING_ADVERTISER_PRICE_USD`) exactly as before. The model annualizes
the trailing ledger, compares the blend to a target, projects it over a **5-year horizon**, and does the same
per business customer.

Every dollar must come from a business or from structural margin — never a customer markup. The report carries
the same invariant as `revenueReport`: `customer_paid_usd` must stay **0**.

## Two kinds of line — and why it de-risks the target

- **Sales-driven (~$150k of the target):** businesses you actively sign, upsell, and renew — advertisers
  (`advertising`/`grid_fee`), B2B SaaS (`business_subscription`), sponsored placements, sign-up/onboarding
  fees, audience panels, white-label, sponsored prizes.
- **Activity-driven floor (~$50k of the target):** minted by member engagement with no sales headcount —
  seller commission, sourcing margin, breakage, BNPL/processing/shipping spreads, affiliate & lead fees,
  dev/creator cut, membership. This is the floor that holds the number up during a slow sales quarter.

The report returns both subtotals and the activity-driven share, so you can see how much of the run-rate is
self-minting versus sold.

## The illustrative target blend (tunable)

`REVENUE_STACK_TARGET_BLEND` (JSON, admin-editable) — sums to $200k:

| Line (RevenueEvent type) | Annual target | Kind |
|---|---|---|
| `advertising` — PPC advertisers (~8 seats × $12k) | $96,000 | sales |
| `business_subscription` — B2B SaaS tiers | $30,000 | sales |
| `sponsored_placement` — placements / ad slots | $20,000 | sales |
| `seller_commission` | $15,000 | activity |
| `breakage` (estimated from outstanding points) | $15,000 | activity |
| `sourcing_margin` | $10,000 | activity |
| `bnpl_merchant_fee` | $5,000 | activity |
| `processing_rebate` | $3,000 | activity |
| `shipping_margin` | $2,000 | activity |
| `affiliate_commission` | $2,000 | activity |
| `lead_fee` | $2,000 | activity |
| **Total** | **$200,000** | |

Numbers are a planning blend, not a promise. Change the JSON to reshape the mix; the report always compares
actual annualized run-rate to whatever blend is set.

## Per customer, over 5 years

`customerFiveYearValue()` takes a business's trailing `RevenueEvent` rows, annualizes them, and projects the
run-rate flat over `CUSTOMER_VALUE_HORIZON_YEARS` (default 5). `topCustomersByValue()` ranks accounts by that
5-year value. This is the "each customer over five years" view — grounded in what they've actually generated,
not a hoped-for figure.

## Results is the spine

Conversion and retention across every sold line run on **proof**: the per-business attributed-sales
measurement (`attributedSalesUsd` / `computeFreeAdvertiserRevenueShare` in `earned-advertiser.ts`) and the
`RevenueEvent` ledger. An advertiser watching their own attributed number climb is what converts a free-tier
seat to the $12k package and renews it. Aggregate results claims to prospects ("advertisers average $X") are
FTC earnings claims — substantiate them with real data and a typical-results basis; individualized real
numbers are the safe, stronger pitch.

## Where it lives in code

- Settings (Revenue category): `REVENUE_STACK_ANNUAL_TARGET_USD` (200000), `REVENUE_STACK_HORIZON_YEARS` (5),
  `CUSTOMER_VALUE_HORIZON_YEARS` (5), `REVENUE_STACK_TARGET_BLEND` (JSON).
- Model: `backend/sdk/revenue-stack.ts` — `buildRevenueStack`, `customerFiveYearValue`, `topCustomersByValue`,
  annualize/project helpers, sales-vs-activity classification.
- Function (INTERNAL/ADMIN): `revenueStackReport` — body `{ days?, business_id?, top? }`.
- Admin page: `/RevenueStack` — progress to $200k/yr, per-line vs target, sales/activity split, 5-year
  projection, top customers by 5-year value.

Nothing here bills or charges. It reads the ledger and reports.
