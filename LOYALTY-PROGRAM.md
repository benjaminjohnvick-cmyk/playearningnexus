# Loyalty & Rewards Program — build + compliance posture

What got built (this pass) for the retail-loyalty reframe we discussed. Not legal advice — a structural
risk-reducer. The whole thing is config-driven; the money/cap knobs are on the AI optimizer's denylist so
they're never auto-tuned.

## The two lines the code never crosses (the protection)

1. **Users never pay cash to obtain points/benefits** — everything is earned through activity or granted.
2. **Points/benefits never convert to cash** — closed-loop, redeemable only in your store.

Keep both and this stays a loyalty program (like miles / card points / Starbucks stars), not money
transmission or stored value. The engine (`backend/sdk/loyalty.ts`) enforces this by construction.

## The value model

- The headline benefit is a **10% member discount taken off the BASE price** of eligible first-party
  purchases. The **platform absorbs it** — it is affordable because each matched advertiser now pays the
  **$6,000** grid price (up from $5,000), far more than 10% of a normal year of that member's purchases.
  The discount comes off the **base price only**; your **store markup is charged and kept separately, so
  store margin is never reduced.** (`recordLoyaltyDiscount()`)
- 10% applies to **all** eligible purchases, up to a **per-member annual backstop cap** — a back-end
  number the user never sees (`LOYALTY_ANNUAL_VALUE_CAP_USD`) that ensures a single heavy buyer can never
  draw more discount than the advertiser payment backing them. When reached, the discount stops for the
  term. `loyaltyStatus` returns only booleans (`discount_active`) — never the cap or the cumulative figure.
- **Affordability math:** at 10% off the base, a member would have to buy **$60,000** of goods in a year
  before the discount ($6,000) equaled the advertiser's payment — and you still keep your markup and the
  survey/ad revenue on top. So it's comfortably funded; the cap is just a safety rail.
- To be **eligible to use the discount on a purchase**, that day the member must have completed the
  daily PPC-survey requirement (`LOYALTY_DAILY_SURVEY_REQUIREMENT_USD`, default **$8** of surveys), hold
  an active **social-post consent** (posts carry a clear **#ad** disclosure), and have agreed to the
  **one-year term**. (`eligibleForDiscount()` gates the discount on all of this.)
- **1:1 capacity:** rewarded members are matched to signed-up advertiser businesses
  (`LOYALTY_CAPACITY_PER_BUSINESS`, default 1). There are never more rewarded members than businesses
  funding them — which is exactly what guarantees every discount is backed by real advertiser revenue.
  Enrollment past capacity is waitlisted. (`hasLoyaltyCapacity()`)
- **Term + renewal:** a one-year term requiring ≥ `LOYALTY_REQUIRED_DAYS_PER_WEEK` (default 5) active
  days/week. Nothing auto-renews — after a full year the member is **asked to sign up again**
  (`renewal_due`). A missed day never creates debt or penalty; it just doesn't count that day.
- **Ongoing posting until a $12,000 return:** the member keeps posting their consented #ad content until
  the matched business has received **$12,000** in fulfilled orders (2× the $6,000 grid —
  `PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD`), after which the ongoing-posting obligation ends.

## Cheapest-price search + the 10% (`productBestPrice`)

When a shopper picks an exact product, `productBestPrice` scores every offer we can price by **all-in
landed cost** (item + tax + shipping − existing discounts) and returns the cheapest, then applies the 10%
**by source**: a **real discount** on a first-party winner (platform-absorbed), or **10% back as loyalty
credit** on an external retailer (we can't change another store's checkout, so it's an honest
credit-back, never a fake lower price). Honest scope: it prices our first-party listings plus any
external offers a connected shopping/price feed passes in (`external_offers`); it does not crawl the whole
internet, and it returns shopping-discovery links so the shopper can compare externally. Scorer lives in
`backend/sdk/pricing.ts`.
- **Partial redemption:** members choose how many points to put toward an item and pay the rest by card;
  the member discount applies on top; everything is purchased on your site (closed-loop). The discount is
  scoped to **first-party (platform) items** so member-seller payouts stay whole.

## The eleven value levers (all config, same generated-revenue funding)

Defined in `loyaltyPerks()` and surfaced by `loyaltyStatus`: (1) vested welcome bonus, (2) earn-over-time
accrual, (3) active-member earn multiplier, (4) the 10% member discount [wired into checkout], (5) member
free shipping, (6) status tiers, (7) double-sided referral points, (8) points rebate on purchases, (9)
streak bonuses, (10) first-order perk, (11) merit contests (skill-ranked, never chance). The money-moving
ones (discount, rebate, multiplier, first-order, welcome bonus) are configurable dollar/rate knobs; the
rest are honored by their existing subsystems (referrals, streaks, tiers, jackpots) via their own flags.

**Honest status of the 11:** #4 the **member discount is fully wired end-to-end** into checkout. The
other ten are **defined, configured, and surfaced** in `loyaltyStatus` — the money knobs (welcome bonus,
earn multiplier, rebate, first-order, free shipping) are live config, and #6/#7/#9/#11 (tiers, referral,
streaks, merit contests) **reuse the platform's existing engines** rather than being re-coded. They are
not each independently re-wired into their own new flow; that's the remaining polish if you want each one
as bespoke loyalty logic instead of riding the existing systems.

## What got added (files)

- `backend/sdk/loyalty.ts` — the engine (consents, 1:1 capacity, base-price discount quote, platform-
  absorbed discount accounting + annual backstop cap, perks, renewal). All money moves are atomic CAS.
- `backend/sdk/pricing.ts` — all-in landed-cost scorer (`rankOffers`/`cheapestOffer`), + `productBestPrice`.
- `backend/functions/loyaltyEnroll` — join (requires the two consents + an open 1:1 slot).
- `backend/functions/loyaltyStatus` — member view (booleans only; hides the cap + pool figures).
- `backend/functions/loyaltyQuoteDiscount` — the discount for a given cart (for the UI).
- `backend/functions/loyaltyDailyReconcile` — scheduled daily: accrue the pool from the day's generated
  revenue for members who did their surveys, track the 5-day/week tally, flag renewal, stop at the cap.
- `purchaseMarketplaceListing` — applies the pool-funded discount at checkout (points + card), redeeming
  from the pool only on a captured sale.
- Config in `settings.ts` (+ optimizer denylist), the `loyalty_program` feature flag (ON by default),
  and the `LoyaltyLedger` entity (audit trail).

## Honest compliance caveat

This structure is about as low-risk as a rewards program gets, but "no lawyer at all" isn't something I
can promise. The small, bounded items still worth a cheap check when you turn real money on: the promo
terms for the clawback-free bonus, the auto-renewal/cancel disclosure on any recurring fee, sales tax
(a tax-tool job, not a lawyer), and privacy basics if you'll have CA/EU users. Everything above is
standard retail-loyalty practice, which is the point — the reframe shrinks the surface to those few items.
