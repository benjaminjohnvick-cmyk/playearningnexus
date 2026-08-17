# Tier 2 — Upfront Deposits (prepay a year), done right

*How an advertiser can prepay a full year (or term) of Tier 2 upfront even though delivery is capacity-paced —
and the two rules that keep a year's deposit fair and compliant. Current as of 2026-08-15. Admin-tunable; not
legal advice.*

## Why this is the clean direction

Taking payment **upfront** is a **prepayment**: the advertiser pays the platform now. That means **no credit is
extended, no loan, no money-transmission** — the exact opposite of the retired "advertise now, pay at
year-end" idea (which was deferred-payment credit and had to be gated). Annual ad and SaaS contracts are paid
this way routinely. So a Tier 2 deposit is compliant to take.

## The one obligation it creates, and how it's handled

Because Tier 2 can be **capacity-paced** (impressions delivered as the audience grows), a full-year deposit is
money held for impressions **not yet delivered** — i.e. **unearned revenue**, with the advertiser effectively a
creditor for the undelivered part. Two rules keep that fair:

1. **Earned as delivered.** The deposit is recognized as revenue only as impressions are actually served
   (`depositDeliveryStatus` splits it into `earned_usd` vs `unearned_usd`). The undelivered portion is a
   liability, not booked profit.
2. **Make-good OR refund the shortfall.** Any allotment still undelivered at term end is resolved one of two
   ways (`TIER2_DEPOSIT_MAKEGOOD_MODE`):
   - **extend** (default) — delivery continues past term end until the full paid allotment is served, or
   - **refund** — the undelivered portion is refunded pro-rata (`TIER2_DEPOSIT_REFUND_UNDELIVERED`).

   Either way the advertiser gets **every impression they paid for, or their money back for the shortfall.**

## What it looks like

A founding advertiser prepays a year: net **$189,000** (after the 5.5% discount) for **3,500,000** impressions.
If, say, 40% has delivered so far, **$75,600 is earned** and **$113,400 is held as unearned revenue** — which,
under refund mode at term end, is exactly the pro-rata refund owed for the undelivered 60%. Under extend mode,
that 60% simply keeps delivering until it's served.

## Disclosure (shown at purchase)

The advertiser must accept these terms (`tier2Deposit` records consent): you're prepaying $X for N impressions
over your term; it's a prepayment for advertising, not a loan/deposit account/investment; delivery is paced to
the audience and your deposit is earned only as impressions deliver; undelivered impressions are made good or
refunded pro-rata at term end; the undelivered portion is held as unearned revenue until delivered or resolved.

## Where it lives

- Model: `backend/sdk/tier2-deposit.ts` (`depositQuote`, `depositDeliveryStatus`, `depositDisclosures`).
- `tier2Deposit` (record a deposit, with a preview mode and recorded consent) + `tier2DepositStatus`
  (delivered-vs-paid, earned vs unearned, refund owed).
- Settings: `TIER2_DEPOSIT_ENABLED` (on), `TIER2_DEPOSIT_MONTHS` (12), `TIER2_DEPOSIT_MAKEGOOD_MODE` (extend),
  `TIER2_DEPOSIT_REFUND_UNDELIVERED` (on).

## For your attorney

A prepaid annual advertising deposit with paced delivery is generally fine as commercial commerce, but confirm:
(a) the unearned-revenue treatment and refund/make-good terms are adequate for your states; (b) any
large-prepayment or advance-fee rules that could apply; (c) that the disclosure is clear and conspicuous. This
belongs alongside the multi-year-continuation item in `FOR-YOUR-ATTORNEY.md`.
