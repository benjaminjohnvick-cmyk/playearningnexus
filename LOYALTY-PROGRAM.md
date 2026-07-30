# Loyalty & Rewards Program — build + compliance posture

What got built (this pass) for the retail-loyalty reframe we discussed. Not legal advice — a structural
risk-reducer. The whole thing is config-driven; the money/cap knobs are on the AI optimizer's denylist so
they're never auto-tuned.

## The two lines the code never crosses (the protection)

1. **Users never pay cash to obtain points/benefits** — everything is earned through activity or granted.
2. **Points/benefits never convert to cash** — closed-loop, redeemable only in your store.

Keep both and this stays a loyalty program (like miles / card points / Starbucks stars), not money
transmission or stored value. The engine (`backend/sdk/loyalty.ts`) enforces this by construction.

## The two-tier value model

- **Non-premium users (~95%)** pay the normal **10%-marked-up** price (mostly by card). That markup is
  the platform's margin on them. They're not in the loyalty program and get no points-back.
- **Premium / loyalty members (~5%)** pay **NO markup** at all, and *also* get **10% back in points
  (store credit)** on every purchase — **funded by their matched advertiser's $6,000 grid payment**, not
  by store margin. Premium purchases are a pure advertiser/affiliate-funded tier (no commerce margin from
  them by design; the non-premium markup is the commerce engine). The points-back is granted after the
  sale (`recordLoyaltyDiscount()` → `current_balance`), capped at a back-end **annual** value
  (`LOYALTY_ANNUAL_VALUE_CAP_USD`, $1,460) that **resets each program year**; `loyaltyStatus` returns only
  booleans (`cashback_active`) — never the cap or cumulative usage.

## Optional: take rewards UP FRONT (premium opt-in, affiliate vesting)

A premium member may opt to take their reward value **up front** instead of earning 10% at a time. On
opt-in (`loyaltyUpfrontEnroll`) they're enrolled as an **affiliate** and the grant (`LOYALTY_UPFRONT_GRANT_USD`,
default $1,460) is **escrowed**, then **released to spendable store credit incrementally** as they generate
real affiliate **commission worth a multiple of the grant** (`LOYALTY_UPFRONT_MULTIPLE`, default **2×**),
in steps (`LOYALTY_UPFRONT_MILESTONES`, default 4 = 25% per quarter of the target). Engine:
`enrollUpfront()` + `recordAffiliateProgress()` (wired into the affiliate-commission engine, atomic).

Design choices, as agreed:
- **Incremental release** — 25% of the grant releases at each quarter of the 2× commission target.
- **2× measured in real commission that reaches the platform** — the member's affiliate commission funds
  the platform (which keeps it); their reward is the released grant, so the platform is always ahead.
- **No clawback** — released credit is theirs to keep; nothing is ever owed. If they stop, the unreleased
  remainder simply doesn't release. It is **logged as reclaimed liability in the ledger, never credited to
  the owner** — crediting the house its own scrip adds no value and would muddy the clean vesting posture.
- **Vesting, not a loan** — the whole structure is "unlock what you earn," which is what keeps it low-risk.
  Affiliate tasks are sales/promotion (with #ad disclosure), never mandatory recruitment (pyramid risk).
- **Affordability:** a premium member would have to buy $60,000/year before their 10% points-back ($6,000)
  equaled the advertiser payment backing them — and most never approach the $1,460 cap, so real cost per
  member is far lower. The advertiser fee covers it with large headroom; the cap is a safety rail.

## Scaling — the eight levers (why it works past 1:1)

1/7 — **Capacity is a dynamic governor, not 1:1** (`computeLoyaltyCapacity`): premium slots =
`pooled_revenue × budget_fraction ÷ $1,460`. It grows automatically as revenue grows and is worst-case
solvent (each member reserved the full annual cap). 2/6 — **Pooled, diversified funding**
(`pooledAnnualRevenueUsd`): advertiser grid fees **+ `LOYALTY_EXTRA_POOL_USD`** (annualized affiliate + ad
+ membership revenue), so no single business or stream is load-bearing. 4 — **Each member's benefit is
capped** ($1,460/yr) far below the ~$6,000 their participation attracts → self-funding with margin. 5 —
**Tiered** premium vs non-premium, governed toward `LOYALTY_TARGET_PREMIUM_FRACTION` (5%). 8 —
**Indefinite membership**: runs year-to-year as long as the daily requirements are met; the annual mark is
a **re-consent reminder** (`reconsent_due`), not a hard stop, and the $1,460 cap resets each year.
- To be **eligible for points-back on a purchase**, that day the member must have completed the daily
  PPC-survey requirement (`LOYALTY_DAILY_SURVEY_REQUIREMENT_USD`, default **$8** of surveys), hold an
  active **social-post consent** (posts carry a clear **#ad** disclosure), and have their annual re-consent
  current. (`eligibleForDiscount()` gates it.)
- **Ongoing posting until a $12,000 return:** the member keeps posting their consented #ad content until
  the matched business has received **$12,000** in fulfilled orders (2× the $6,000 grid —
  `PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD`), after which the ongoing-posting obligation ends.

## Cheapest-price search + the 10% (`productBestPrice`)

When a shopper picks an exact product, `productBestPrice` scores every offer we can price by **all-in
landed cost** (item + tax + shipping − existing discounts) and returns the cheapest. The 10% is delivered
as **loyalty points-back after purchase — on whichever option wins, first-party or external** — because
the sticker price is never lowered (we can't change another store's checkout, and the markup stays for
everyone). Honest scope: it prices our first-party listings plus any external offers a connected
shopping/price feed passes in (`external_offers`); it does not crawl the whole internet, and it returns
shopping-discovery links so the shopper can compare externally. Scorer lives in `backend/sdk/pricing.ts`.
- **Partial redemption:** members choose how many points to put toward an item and pay the rest by card;
  points-back applies on top; everything is purchased on your site (closed-loop). Points-back is scoped to
  **first-party (platform) items** so member-seller payouts stay whole.

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

- `backend/sdk/loyalty.ts` — the engine (consents, dynamic capacity governor, 10% points-back quote,
  advertiser-funded annual points-back cap with yearly reset, indefinite membership + re-consent, perks).
  All money moves are atomic CAS.
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

## Savings tracker (`loyaltySavings`) — factual, hands out nothing

A mirror of realized activity: **net savings = survey earnings + points-back received − markup paid**,
plus a **real-dollar figure** (`real_world_savings_usd`) and a **"% saved via surveys"**. For a
non-premium user it starts negative (they paid the markup) and climbs toward **zero** as survey earnings
offset it; for a premium user (no markup) it sits **positive** and grows with points-back + surveys. It
grants nothing — it only displays value already earned. Kept strictly **backward-looking** (never "you'll
earn"), which is the FTC-safe framing. Gated behind the `purchase_payback` admin toggle; a compact version
(`real_world_savings_usd`, `net_savings_usd`, `percent_saved`) is also surfaced in `loyaltyStatus`.

## Honest compliance caveat

This structure is about as low-risk as a rewards program gets, but "no lawyer at all" isn't something I
can promise. The small, bounded items still worth a cheap check when you turn real money on: the promo
terms for the clawback-free bonus, the auto-renewal/cancel disclosure on any recurring fee, sales tax
(a tax-tool job, not a lawyer), and privacy basics if you'll have CA/EU users. Everything above is
standard retail-loyalty practice, which is the point — the reframe shrinks the surface to those few items.
