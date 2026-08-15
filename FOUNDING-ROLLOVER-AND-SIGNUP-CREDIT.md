# Founding Advertiser — Upgrade Discount + Premium Gift Boost

*Reporting/quoting layer on the founding offer. It grants and vests NON-CASHABLE store credit and PRICES an
upgrade — it never moves money and nothing is ever owed. Not legal advice.*

## What was built (reframed per counsel)

1. **Pay $12,000 upfront** for the founding/Tier 1 seat (unchanged).
2. **Founding upgrade discount (decoupled from the payment).** Founding advertisers get a **promotional
   discount** on a bigger **upgrade** (default **"Tier 2 — Scale," $200,000**). The discount is defined as a
   **percentage of the upgrade price** (default **5.5% → $11,000 off → net $189,000**). A founding member can
   **claim** it within a **12-month** promo window after joining, and it then **rolls over for life**: because
   they hold a founding Tier 1 seat, the 5.5% comes off **every Tier 2 part in perpetuity**
   (`TIER2_FOUNDING_DISCOUNT_PERPETUAL`), whereas a non-founding Tier 1→Tier 2 rollover keeps the 5.5% only
   through the first year (`TIER2_DISCOUNT_FIRST_YEAR_ONLY`). It is **not** a "credit equal to what you paid,"
   makes **no reference** to the amount paid, and is **not derived from it** — it's a straightforward
   founding-advertiser discount on the upgrade.
3. **Premium gift boost (replaces the old sign-up credit) — decoupled from the payment.** Up to **$2,000**
   in **non-cashable store credit**, offered as a **premium-member benefit** funded by a **collective advertiser
   pool**. It is deliberately **not tied to, granted from, or a return of** any member's $12,000 fee — the same
   decoupling used for the upgrade discount, so there is no return-of-capital signal. Tier 1 includes premium, so
   Tier 1 members qualify like any premium member; they **claim** the boost from the pool (subject to
   availability) and choose how much to apply and to which items. A promotional bonus — not a refund, not
   earnings, not credit — **never a charge, never a debt**. The earlier $1,000 vesting credit is **retired**
   (`FOUNDING_SIGNUP_CREDIT_USD = 0`). See `PREMIUM-GIFT-BOOST.md`.

All amounts are closed-loop **Site Cash** (non-cashable). The member never owes anything.

## Why this reframe removes the earlier legal flag

The earlier version granted a **credit equal to the amount paid** ($12,000 paid → $12,000 credit). A benefit
pegged to the amount paid reads as **return-of-capital** — the exact investment-contract signal the founding
legal-review packet removed when it disabled `FOUNDING_FULLKEEP_CAP_TO_PRICE`. This version fixes that at the
source:

- The benefit is a **discount on the upgrade**, defined as a **% of the upgrade price** — a function of the
  *upgrade*, not of the payment. If the upgrade price changed, the discount would change; the payment never
  enters the calculation.
- There is **no "get your $12k back," no "credit," no "rollover," no recoup framing** anywhere in the code,
  disclosures, or UI.
- The economics land at an $11,000 reduction (5.5% of $200,000) **without** the return-of-capital
  signal, because the derivation and the language are decoupled from what was paid.

If counsel wants even more daylight, set `FOUNDING_UPGRADE_DISCOUNT_PCT` to a value whose dollar result is
**not** $12,000, so there's no numeric coincidence with the price paid.

## Remaining compliance notes

- **The $200,000 upgrade must be a real product.** A price with no deliverable behind it is a problem. Define
  the Tier 2 deliverables before selling it; the code only *quotes* the net price, and a $200,000 charge must
  run through the payment processor's own flow (not this scaffold).
- **Referral incentive = FTC disclosure.** Paying a reward for referrals is fine, but must be disclosed as a
  paid incentive, and referrals must be genuine. The code counts only **fraud-screened qualified** referrals
  (`qualifiedReferrals`) — raw invites don't count.
- **Non-cashable stays non-cashable.** The sign-up credit spends only on-site; it never converts to cash. The
  upgrade discount is a price reduction, not scrip.
- Disclose all sign-up conditions up front (`foundingCreditDisclosures()` does this).

## Where it lives in code

- Settings (Founding Advertiser category): `FOUNDING_UPGRADE_DISCOUNT_ENABLED`, `FOUNDING_UPGRADE_DISCOUNT_PCT`
  (0.06), `FOUNDING_UPGRADE_DISCOUNT_MAX_USD` (0 = no cap), `FOUNDING_UPGRADE_DISCOUNT_WINDOW_MONTHS` (12),
  `FOUNDING_UPGRADE_NAME`, `FOUNDING_UPGRADE_PRICE_USD` (200000); sign-up credit: `FOUNDING_SIGNUP_CREDIT_USD`
  (1000), `FOUNDING_SIGNUP_CREDIT_WINDOW_MONTHS` (12), `FOUNDING_SIGNUP_REQUIRE_MONTHS_ACTIVE` (12),
  `FOUNDING_SIGNUP_REQUIRE_FEEDBACK` (true), `FOUNDING_SIGNUP_REQUIRE_REFERRALS` (1).
- Model: `backend/sdk/founding-rollover.ts` — `upgradeDiscountState`, `upgradeQuote`, `signupCreditState`,
  `foundingCreditDisclosures`. (Filename kept for continuity; it now implements the decoupled discount.)
- Functions (read-only): `foundingRolloverStatus`, `foundingUpgradeQuote`.
- Page: `/FoundingUpgrade` — shows the sign-up credit vesting + conditions, the founding upgrade discount, and
  the upgrade net-price quote.

Nothing here charges a card or moves money. It grants/vests store credit and prices the upgrade.
