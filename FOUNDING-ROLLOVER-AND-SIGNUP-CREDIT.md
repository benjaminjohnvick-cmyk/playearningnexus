# Founding Advertiser — Rollover Credit → Upgrade, and the Sign-up Store Credit

*Reporting/quoting layer on the founding offer. It grants and vests NON-CASHABLE store credit and PRICES an
upgrade — it never moves money and nothing is ever owed. Not legal advice.*

## What was built (per the owner's design)

1. **Pay $12,000 upfront** for the founding/Tier 1 seat (unchanged).
2. **Rollover credit → upgrade.** The advertiser receives a **$12,000 store credit** they can roll into a
   bigger **upgrade** (default **"Tier 2 — Scale," $200,000**) **within 12 months**. Applying it prices the
   upgrade at **$200,000 − $12,000 = $188,000**. The credit is **non-cashable**, **usable only toward the
   upgrade**, and **expires** if unused.
3. **Sign-up store credit.** **$1,000** in store credit, vesting in equal monthly tranches over **12 months**
   (~$83.33/mo), **conditional** on the advertiser: (a) **using the app for 12 months**, (b) **submitting
   feedback**, and (c) **bringing 1 fraud-screened referral** (a referred user who completes a first screened
   survey). Feedback + referral are unlock gates; until both are met, nothing vests. Unmet conditions forfeit
   the unvested remainder — **never a charge, never a debt**.

All amounts are closed-loop **Site Cash** (non-cashable). Consistent with the platform's iron rule: the
member never owes anything.

## ⚠️ The one thing counsel must look at: "credit = amount paid"

The rollover credit is set **equal to the amount paid** ($12,000 paid → $12,000 credit). That is exactly the
**return-of-capital** pattern the founding legal-review packet deliberately removed (it disabled
`FOUNDING_FULLKEEP_CAP_TO_PRICE` because a benefit pegged to the amount paid reads as an investment-contract
signal). This build scopes the credit as tightly as possible to reduce that signal — it is **not cash**, it
**only** applies to a specific future purchase, and it **expires** — but the "get your $12k back as credit"
framing still needs review. Options if counsel is uncomfortable:

- Make the credit a **different amount** than the price (e.g. a fixed promotional $2,500 upgrade credit that
  isn't a mirror of what was paid), or
- Frame it purely as an **upgrade discount** decoupled from the payment, or
- Keep it but scrub all marketing of any "earn back / recoup / return" language.

Set `FOUNDING_ROLLOVER_CREDIT_USD` to whatever counsel approves; the code doesn't require it to equal $12,000.

## Other compliance notes

- **The $200,000 upgrade must be a real product.** A price with no deliverable behind it is a problem. Define
  the Tier 2 deliverables before selling it; the code only *quotes* the net price, it does not sell it, and a
  $200,000 charge must run through the payment processor's own flow (not this scaffold).
- **Referral incentive = FTC disclosure.** Paying a reward for referrals is fine, but it must be disclosed as
  a paid incentive, and referrals must be genuine. The code counts only **fraud-screened qualified**
  referrals (`qualifiedReferrals`) — raw invites don't count.
- **Non-cashable stays non-cashable.** None of this credit converts to cash; it spends only on-site. That
  keeps the money-transmission shield intact. (Contrast the separate Tier 1 *financed* program, where a real
  cash debt against closed-loop earnings raised a money-transmission question — that's not present here.)
- **Feedback condition** is benign; just make sure the credit's conditions are all disclosed up front (the
  `foundingCreditDisclosures()` lines do this).

## Where it lives in code

- Settings (Founding Advertiser category): `FOUNDING_ROLLOVER_CREDIT_ENABLED`, `FOUNDING_ROLLOVER_CREDIT_USD`
  (12000), `FOUNDING_ROLLOVER_CREDIT_WINDOW_MONTHS` (12), `FOUNDING_UPGRADE_NAME`, `FOUNDING_UPGRADE_PRICE_USD`
  (200000), `FOUNDING_SIGNUP_CREDIT_USD` (1000), `FOUNDING_SIGNUP_CREDIT_WINDOW_MONTHS` (12),
  `FOUNDING_SIGNUP_REQUIRE_MONTHS_ACTIVE` (12), `FOUNDING_SIGNUP_REQUIRE_FEEDBACK` (true),
  `FOUNDING_SIGNUP_REQUIRE_REFERRALS` (1).
- Model: `backend/sdk/founding-rollover.ts` — `rolloverState`, `upgradeQuote`, `signupCreditState`,
  `foundingCreditDisclosures`.
- Functions (read-only): `foundingRolloverStatus`, `foundingUpgradeQuote`.
- Page: `/FoundingUpgrade` — shows the sign-up credit vesting + conditions, the rollover credit, and the
  upgrade net-price quote.

Nothing here charges a card or moves money. It grants/vests store credit and prices the upgrade.
