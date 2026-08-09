# Advertiser Pricing & Free-Tier Revenue Share (2026)

*Authoritative summary of the current advertiser pricing. Admin-tunable via settings; nothing here is a
promise of returns. Not legal advice — the revenue-share is counsel-gated (see notes).*

## Paid advertiser (PPC / Tier 1)

- **Price: $12,000 per year, or $1,000 per month — paid upfront.**
- Settings: `PPC_GRID_ANNUAL_PRICE = 12000`, `PPC_GRID_MONTHLY_PRICE = 1000`,
  `FOUNDING_ADVERTISER_PRICE_USD = 12000`, `FOUNDING_ADVERTISER_MONTHLY_PRICE_USD = 1000`.
- Everything the advertiser receives (impressions, priority placement, free AI creative, analytics,
  A/B testing, sentiment insights, etc.) is a delivered product/feature — never a financial return.

## Free earn-to-unlock advertiser (unchanged goal, new recovery tail)

- **Still free. Nobody owes anything.** A member reaches advertiser status through their own activity.
- **Earn the ~$8,000 unlock over the 4-year term** (unchanged — `TARGET_USER_LTV_USD = 8000`,
  `FREE_TIER_TERM_YEARS = 4`).
- **Then the platform recovers the rest of the $12,000 package value via a NON-RECOURSE revenue-share:**
  - **10%** of the member's generated revenue **until $12,000 total is recovered**, then
  - **5%** of revenue **ongoing** after that.
  - Settings: `FREE_ADVERTISER_REVSHARE_TARGET_USD = 12000`, `FREE_ADVERTISER_REVSHARE_PCT = 0.10`,
    `FREE_ADVERTISER_REVSHARE_POST_PCT = 0.05`. Logic: `freeAdvertiserRevenueShareCut()` in
    `backend/sdk/earned-advertiser.ts` (splits revenue crossing the target: below at 10%, above at 5%).

## Why this is a revenue-share, not a loan (keep it this way)

- **Non-recourse.** The share is taken **only from revenue that actually occurs.** If the member
  generates no revenue, nothing is taken and **nothing is owed** — there is no fixed balance, no debt,
  no charge, no collections.
- For **business** advertisers this is commercial revenue-based financing, which is far lighter-regulated
  than consumer credit — but the moment it becomes a fixed amount owed regardless of revenue, it turns
  into a loan. Do **not** cross that line. Keep it a share of actual revenue.
- Measure the share on **revenue** (clean, verifiable), not "profit" (impractical and disputable).
- Have consumer-finance / commercial-finance counsel review the revenue-share terms and the member
  disclosures before enabling in production.
