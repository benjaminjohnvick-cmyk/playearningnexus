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

- The headline benefit is a **10% member discount**, and it is **funded from the member's own
  generated-revenue pool** — the platform's cut of the survey/PPC-ad revenue their daily activity
  produced — **not from your store markup**. On every sale the store still receives full price, so
  **store margin is untouched**; the discount is paid out of the pool. (`fundDiscountFromPool()`)
- The pool, and therefore the **total discount a member can ever receive per term, is capped at a
  back-end value the user never sees** (`LOYALTY_ANNUAL_VALUE_CAP_USD`, default **$1,460** ≈ $4/day ×
  365). When it's reached, the discount simply stops for the term. `loyaltyStatus` deliberately returns
  only booleans (`discount_active`) — never the pool balance or the cap figure.
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
  (`renewal_due`). A missed day never creates debt or penalty; it just doesn't accrue that day.
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

## What got added (files)

- `backend/sdk/loyalty.ts` — the engine (consents, capacity, pool accrual + cap, discount quote/fund,
  perks, renewal). All money moves are atomic compare-and-set.
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
