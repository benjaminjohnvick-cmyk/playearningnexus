# Premium Gift Boost — advertiser-funded store credit for premium members

*An extension of the platform-funded gift/boost: premium members receive up to $2,000 of NON-CASHABLE store
credit, funded from the PPC / Tier 1 advertisers' fees. The member chooses how much to claim and which items
to spend it on. Value flows advertiser/platform → member only; nothing is owed. Not legal advice.*

## The idea

Advertisers pay their $12,000 Tier 1 / PPC fee. A slice of each fee (default $2,000 — a 1:1 advertiser→member
match, well within the fee) funds a **member-boost pool**. A **premium** member can claim up to **$2,000** of
that pool as non-cashable store credit, then apply as much or as little of it as they like to the items they
choose. It's a loyalty/promotional benefit tied to real advertiser revenue.

## Why it's compliant

- **Not money transmission.** No value moves between users. The credit is granted from the platform pool
  (funded by advertiser fees) to the member — platform → member only, like the group-goals / gift-boost model.
- **Not credit.** It's a gift. Nothing is owed, nothing is deferred, nothing is repaid.
- **Not earnings / not an earnings claim.** It's a promotional boost, not something the member "earned" by
  activity, so it carries no FTC earnings-claim risk.
- **Closed-loop, non-cashable.** The boost credit spends only on-platform items; it never converts to cash.
- **Solvent by construction.** Grants are drawn from discrete advertiser funding contributions (consumed 1:1),
  so the platform can never gift more boost than advertisers have actually funded.
- **User-controlled.** Off unless the member claims it; they pick the claim amount and which items to apply it
  to; unused credit simply stays theirs.

## How it works

1. **Fund:** when a PPC / Tier 1 advertiser pays, call `premiumBoostFund({ advertiser_id, amount_paid_usd })`.
   It adds `PREMIUM_BOOST_PER_ADVERTISER_USD` ($2,000) to the pool as one funded contribution.
2. **Claim:** a premium member calls `premiumBoostClaim({ amount_usd? })` — they choose how much, up to their
   remaining cap (`PREMIUM_GIFT_BOOST_MAX_USD`, $2,000) and what the pool holds. The amount is consumed from
   advertiser funding and granted as non-cashable boost credit (`gift_boost_credit_usd` on the member).
3. **Apply:** the member calls `premiumBoostApply({ item_name, item_price_usd?, amount_usd })` to put a chosen
   amount of their boost toward a chosen item; it debits their boost credit and hands the applied amount to the
   normal order/checkout flow as a discount/credit. Unused credit stays for other items.

## Where it lives in code

- Flag: `premium_gift_boost` (ON). Settings: `PREMIUM_GIFT_BOOST_MAX_USD` (2000),
  `PREMIUM_BOOST_PER_ADVERTISER_USD` (2000), `PREMIUM_BOOST_REQUIRE_PREMIUM` (true).
- Model: `backend/sdk/premium-boost.ts` — config, `isPremium`, `poolAvailableUsd`, `consumeFunding`,
  `memberGrant`, `premiumBoostStatus`, `premiumBoostDisclosures`. Member credit is the User field
  `gift_boost_credit_usd`, moved via `adjustUserBalance`.
- Entities: `PremiumBoostFunding` (global — advertiser contributions), `PremiumBoostGrant` (owner-scoped by
  member — claimed/used).
- Functions: `premiumBoostStatus` (read), `premiumBoostClaim`, `premiumBoostApply`, `premiumBoostFund`
  (internal/admin — the advertiser-payment hook).
- Page: `/PremiumBoost`.

## The one integration point

`premiumBoostFund` must be called when an advertiser fee is recorded (Tier 1 / PPC), so the pool reflects real
advertiser revenue. Until it's wired, the pool stays at $0 and members see "the pool is momentarily empty" —
everything else (claim/apply, caps, member-direction) works the moment the pool is funded. Relationship: this
is the premium, advertiser-funded sibling of the peer `gift_boost` (GIFT-BOOST.md); both are platform→recipient,
non-cashable, and never user-to-user.
