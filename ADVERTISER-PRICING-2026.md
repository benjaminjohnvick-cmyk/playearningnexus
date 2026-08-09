# Advertiser Pricing & Free-Tier Revenue Share (2026)

*Authoritative summary of the current advertiser pricing. Admin-tunable via settings; nothing here is a
promise of returns. Not legal advice — the revenue-share is counsel-gated.*

## Paid advertiser (PPC / Tier 1)

- **Price: $12,000 per year, or $1,000 per month — paid upfront.**
- Settings: `PPC_GRID_ANNUAL_PRICE = 12000`, `PPC_GRID_MONTHLY_PRICE = 1000`,
  `FOUNDING_ADVERTISER_PRICE_USD = 12000`, `FOUNDING_ADVERTISER_MONTHLY_PRICE_USD = 1000`.

## Free earn-to-unlock advertiser — reconciled model

- **Still free. Nobody owes anything. Non-recourse throughout.**
- **Step 1 — earn the ~$8,000 unlock over the 4-year term** (`TARGET_USER_LTV_USD = 8000`,
  `FREE_TIER_TERM_YEARS = 4`). This $8,000 **counts toward parity** with a paid $12,000 advertiser.
- **Step 2 — revenue-share recovers only the REMAINING $4,000** ( = $12,000 parity target − $8,000
  earn-to-unlock credit ), taken as a share of the advertiser's **own business revenue**:
  - **10%** of business revenue **until the remaining $4,000 is recovered**, then
  - **5%** of business revenue **in perpetuity**, for as long as they use the platform.
- Settings: `FREE_ADVERTISER_REVSHARE_TARGET_USD = 12000`, `FREE_ADVERTISER_EARN_UNLOCK_CREDIT_USD = 8000`
  (⇒ revenue-share recovers $4,000), `FREE_ADVERTISER_REVSHARE_PCT = 0.10`,
  `FREE_ADVERTISER_REVSHARE_POST_PCT = 0.05`.
- Logic: `freeAdvertiserRevenueShareCut()` in `backend/sdk/earned-advertiser.ts` applies 10% only up to
  the $4,000 remainder (splitting any revenue that crosses the line), then 5% thereafter.

### Worked example (business revenue)

| Their business revenue | 10% cut/mo | Months to clear the $4,000 | 5% perpetual tail |
|---|---|---|---|
| **$20,000/mo** | $2,000 | **2 months** | $1,000/mo |
| **$6,667/mo** | ~$667 | **6 months** | ~$333/mo |
| **$3,333/mo** | ~$333 | 12 months | ~$167/mo |
| **$1,667/mo** | ~$167 | 24 months | ~$83/mo |

*("Clear $12,000 in 6 months at 10%" would need ~$20k/mo of business revenue. Because the $8,000
earn-to-unlock counts toward parity, the revenue-share only has to recover $4,000 — so a $6,667/mo
advertiser clears in ~6 months, and a $20k/mo advertiser clears the $4,000 in ~2 months.)*

## Keep it a revenue-share, not a loan

- **Non-recourse.** Taken **only** from business revenue that actually occurs. No revenue → nothing taken,
  nothing owed. No fixed balance, no debt, no charge, no collections.
- Measure the share on **revenue** (verifiable), not "profit." Define **how** business revenue is measured
  (attributed orders through the platform/store is the clean, auditable source; off-platform self-reported
  revenue is not).
- For business advertisers this is commercial revenue-based financing (far lighter than consumer credit) —
  but the moment it becomes a fixed amount owed regardless of revenue, it's a loan. Do not cross that line.
- Have commercial-finance counsel review the revenue-share terms + disclosures before enabling.
