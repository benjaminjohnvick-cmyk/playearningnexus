# Counsel brief — daily usage fee + PayPal BNPL checkout (and the ideas we deliberately EXCLUDED)

**For the attorney.** Two revenue features are BUILT and shipped **OFF by default pending your review**. This
brief states how each works, the questions we need ruled on, and — importantly — documents four related ideas we
**decided NOT to build** and exactly why, so you can confirm the boundary or tell us whether any licensed path
exists. Nothing charges a user or moves money until you approve and we enable the flags. Design spine:
**value/fees taken only from a user's own earned rewards (never a debt), disclosed honestly, and the platform
never funds or repays a consumer's loan.**

---

## 1) Uniform daily platform-usage fee (from earnings only) — BUILT, gated OFF

**What it does.** A small **uniform** daily fee (default **$0.80/day**, `USAGE_FEE_ENABLED=0`) charged to **all
users the same way**, deducted **only from a user's already-EARNED rewards** (the non-cashable Site Cash/points
balance). Two hard rules are built into the math:
- **No debt.** The fee is deducted only from available earnings. If a user hasn't earned it, it simply does not
  accrue — a user can never *owe* money for using the site, and a balance can never go negative.
- **Honest net.** The fee is disclosed at signup and in earnings views, and the app surfaces the **one extra
  advertiser-funded survey** that offsets it, so a user still **nets** their target (~$4/day). Earnings claims
  are stated NET of the fee — never a gross figure the fee quietly reduces.
The fee stops at a **cap** (default **$182**, over a rolling window `USAGE_FEE_CAP_PERIOD_DAYS`, default 365; 0 =
lifetime). Code: `sdk/usage-fee.ts`, `usageFeeApply` (gated; preview-only while disabled), `usageFeeStatus`
(read-only). Ledger type `usage_fee`.

**Why uniform matters.** The fee is deliberately **decoupled from any payment method**. That is what keeps it
outside PayPal's surcharge prohibition (see §2) — a fee that applied only to PayPal/BNPL users, or a rebate that
excluded them, would be a disguised surcharge.

**Questions for counsel.**
- Is a per-day usage fee **taken only from earned, non-cashable rewards** (never billed, never a debt) acceptable
  as a platform fee, and are the disclosure + honest-net-earnings mechanics sufficient to avoid a deceptive-
  practices (FTC/UDAAP) issue?
- Any negative-option / recurring-fee disclosure requirements, given the fee recurs (even though it is deducted
  from rewards, not charged to a card)?
- Confirm the "net $X/day after a small usage fee, offset by one extra survey" framing is the correct way to
  state earnings, and that our marketing must not show a gross figure.

## 2) PayPal Buy-Now-Pay-Later checkout for real goods — BUILT, gated OFF

**What it does.** A (premium) member can finance an **actual purchase of goods/services** through PayPal Pay
Later (Pay in 4 up to $2,000; Pay Monthly higher). **PayPal pays the platform in full up front and PayPal + its
bank partner carry the consumer credit risk** — the platform is only the store; the member repays PayPal
directly. An optional **uniform order service fee** (default **10%**, `BNPL_SERVICE_FEE_PCT`) is applied the
**same regardless of payment method**, so it is **not** a fee for using PayPal. The only BNPL-specific logic is
the **cap**: purchase + fee must fit under the PayPal limit, so the max financeable item price leaves room for
the fee (at $2,000 / 10%, max item price = **$1,818.18**, fee **$181.82**, total **$2,000**). Premium-only by
default (`BNPL_PREMIUM_ONLY=1`). Code: `sdk/bnpl-checkout.ts`, `bnplCheckoutQuote` (quote/eligibility only — the
live PayPal Pay Later API call requires PayPal merchant onboarding and is intentionally not invoked). Flag
`BNPL_CHECKOUT_ENABLED=0`.

**Key legal fact we designed around.** PayPal's user agreement states: *"You agree that you will not impose a
surcharge or any other fee for accepting PayPal as a payment method."* Handling fees are allowed only if they
**do not function as a surcharge** and **do not exceed** what is charged on non-PayPal transactions. So the
service fee is modeled as a **uniform order fee**, not a PayPal/BNPL fee.

**Questions for counsel.**
- Confirm a **uniform** order service fee (same for all payment methods) is not a prohibited surcharge under
  PayPal's terms or applicable state surcharge/convenience-fee law.
- Because the fee is **financed along with the purchase**, could it be recharacterized as a **finance charge**
  (TILA disclosure) or make us a **credit-services organization / broker**? We intend it to be a goods/services
  fee, not a charge for credit — confirm the structure holds.
- Any disclosures required when offering BNPL at checkout (we already show that the loan is the user's own
  obligation to PayPal and that the platform does not fund/cover/repay it).
- Confirm merchant eligibility / product-category approval is PayPal's to grant.

## 3) Ideas we deliberately EXCLUDED (and why) — please confirm the boundary

We considered and **did not build** the following, because each makes the platform the effective lender/
guarantor or crosses PayPal's terms. We are asking you to confirm these are correctly out of scope, or to tell
us whether a **licensed** path would change the analysis.

1. **Converting a BNPL "purchase" into Site Cash / a stored-value top-up.** Would turn a purchase rail into a
   cash-advance for stored value (PayPal AUP restricts cash-equivalents/stored value; funding it with credit is
   the prohibited pattern), and would put borrowed money into the rewards economy. **Excluded.**
2. **A "$2,000 boost" (or platform funds) covering/repaying the member's BNPL loan.** Would make the platform the
   guarantor and gift ~$2,000 of real value per member — unlicensed lending + unsustainable + a fraud magnet.
   **Excluded.**
3. **Rebating the service fee to everyone EXCEPT BNPL users** (so only BNPL users bear it). Economically identical
   to surcharging BNPL — a disguised surcharge that violates PayPal's no-surcharge rule (which looks at effect).
   **Excluded.**
4. **Letting a user add friends/family so their activity makes the member's BNPL payment.** Recruitment-for-
   financial-gain tied to debt (pyramid / endless-chain exposure), repayment funded by others' platform activity
   rather than the borrower's own funds (disguised guaranty + money transmission), and pressures personal
   relationships into a debt-funding scheme (UDAAP / consumer-harm). Contradicts our single-tier, activity-based,
   no-downline referral posture. **Excluded.**

**The bright line we are holding:** the member repays PayPal from **their own independent funds**; the platform
and other users **never** fund, cover, guarantee, pool-to-repay, or route earnings to a member's loan. That is
what keeps PayPal — not us — holding the credit risk and the lending license. (A user is of course free to use
money **they have already cashed out** to pay their own PayPal balance; that needs no feature from us.)

## Guardrails already coded (so you can rely on them)

- Usage fee: deducted **only from earned rewards**, clamped to available balance (**never a debt**), capped,
  disclosed, offset by one extra survey; idempotent per user/day; **preview-only** while disabled.
- BNPL: **uniform** service fee (not a surcharge); purchase + fee **capped** under the PayPal limit; premium
  gate; disclosures that the loan is the user's own PayPal obligation and the platform never funds/repays it;
  no live charge until PayPal onboarding + your approval.
- Everything **OFF by default**; no user is charged and no money moves until the flags are enabled.

## Owner action after counsel sign-off

Enable per approval: `USAGE_FEE_ENABLED`, `BNPL_CHECKOUT_ENABLED` (and set amounts/caps/period, the service-fee
%, and disclosures to your guidance). Complete PayPal merchant onboarding before enabling the live BNPL charge.
