# Tier 1 Self-Paced — Pay-Your-Own-Way (NO DEBT, not credit)

*The compliant "pay over time" option for the $12,000 Tier 1 package. It replaces the recourse-credit
"Pay From Earnings" model with a pay-as-you-go subscription where **nothing is ever owed**. Because it is
not credit, it ships **ON** with no lender or counsel gate. Not legal advice — have counsel confirm the
subscription/auto-renew disclosures for your states.*

## The problem it solves

The buyer wanted to spread the $12,000 Tier 1 price across the year and "pay it back" as they go — even to
choose their own monthly amount as long as it totals $12,000 by month 12. Any version of *"give them the full
$12,000 package now and collect $12,000 back over the year"* is **regulated credit**, no matter how flexible
the schedule: a fixed amount is owed that survives non-payment (recourse), and paying it in more than four
installments pulls it under TILA/Reg Z. Letting the buyer pick the amounts doesn't remove the debt — it just
reschedules it, and can add an ability-to-repay/balloon problem of its own.

The fix is to **flip "repay" into "pay-as-you-go."** Instead of delivering the whole package on credit and
collecting it back, the buyer pays for each increment of advertising **as they go** and receives that
increment. Nothing is deferred, so there is nothing to repay.

## How it works

- **Pay what you want, when you want.** The buyer chooses each payment amount (min/max are just sane bounds).
  A suggested **$1,000/mo** completes the **$12,000** annual package over 12 months, but no amount is ever
  required and there is no schedule to keep.
- **Benefits accrue in proportion to what's actually paid.** Impressions delivered = the full-year allotment
  (`FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR`, 200,000) × (paid-to-date ÷ $12,000). Pay more, get more;
  pay less, get less. This proportionality is what makes it a fair pay-as-you-go exchange rather than a
  deferral of the full package.
- **Nothing is ever owed.** `amount_owed` is always $0. The "amount to finish the annual package" is shown
  as **optional** — what's left *if* they choose to complete the year — explicitly never a balance.
- **Pause, resume, or cancel anytime, free.** If they stop, they simply stop getting new impressions.
  No balance, no debt, no collections, no recourse, no earnings sweep.
- **The app never moves money on its own.** Each payment the buyer chooses runs through the normal checkout
  processor; this feature only records what was paid and computes the service delivered for it.

## Why this is NOT credit (and needs no gate)

Credit exists the moment a **fixed amount is owed that survives non-payment**. Here there is no fixed
obligation: the buyer only ever pays for value they receive at the moment they pay, and can walk away owing
nothing. So it is **not** a loan, retail-installment sale, or BNPL product — no finance charge, no >4-payment
Reg Z trigger, no state lending license, no creditor of record. It is an ordinary pay-as-you-go / month-to-
month subscription, which needs only plain terms and standard auto-renew/cancellation disclosures (light,
and far less than any "owe $12,000" plan). That is why the `tier1_selfpaced` flag defaults **ON** while the
three credit products (`flexpay`, `tier1_financed`, `goods_advance`) stay **OFF** behind their counsel gates.

This is the same principle that already makes **Tier 2 "Scale"** compliant (pay-as-you-go parts, no debt) —
applied to Tier 1.

## Close cousins (also compliant, if you want a different shape)

- **Layaway** (`layaway` flag, already ON): the buyer pays toward the annual package over the year; it fully
  activates when paid off; cancel = refund minus a small fee. Not credit — delivery is held until paid.
- **Month-to-month subscription:** the $1,000/mo option (`FOUNDING_ADVERTISER_MONTHLY_PRICE_USD`) billed one
  month at a time, cancel anytime — a special case of this same no-debt model.

## What you must NOT reintroduce

The one thing that turns this back into credit is the pairing **"they get the whole package now AND owe the
full $12,000 regardless."** Keep delivery proportional to payment (or held until paid, for layaway) and never
let a balance be owed, and it stays out of lending law.

## Where it lives in code

- Flag: `tier1_selfpaced` (default **ON**) — `backend/sdk/feature-flags.ts`.
- Model: `backend/sdk/tier1-selfpaced.ts` — config, `selfPacedStatus` (benefits/progress; `amount_owed` always 0),
  `assessSelfPacedPayment`, `selfPacedDisclosures`, `activeSelfPacedPlan`.
- Settings (category "Tier 1 Self-Paced (no-debt)"): `TIER1_SELFPACED_TERM_MONTHS` (12, informational),
  `TIER1_SELFPACED_MIN_PAYMENT_USD` (50), `TIER1_SELFPACED_MAX_PAYMENT_USD` (12000), `TIER1_SELFPACED_ALLOW_PAUSE`
  (true), `TIER1_SELFPACED_PRORATE_BENEFITS` (true). Reuses `FOUNDING_ADVERTISER_MONTHLY_PRICE_USD` (1000),
  `FOUNDING_ADVERTISER_PRICE_USD` (12000), `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR` (200000).
- Entity: `Tier1SelfPacedPlan` (owner-scoped) — paid_to_date_usd, payments_made, status (active/paused/canceled).
- Functions: `tier1SelfPacedStatus` (read), `tier1SelfPacedPay` (record a buyer-chosen payment; never moves
  money), `tier1SelfPacedCancel` (pause/resume/cancel — no penalty, no balance).
- Page: `/Tier1SelfPaced` — pay-what-you-want, progress toward the optional annual package, "$0 owed",
  pause/resume/cancel.

## Relationship to the credit products

The recourse-credit **Tier 1 Financed** (`tier1_financed`) and **Flexible Payment Terms** (`flexpay`) remain
in the codebase, OFF and counsel-gated, for if you ever license lending. But the **self-paced no-debt model
is the pay-over-time option to lead with** — it delivers the "spread it across the year, pay your own way"
experience the buyer wanted, without the lending exposure. The concierge offers this as the pay-over-time
path; the credit products are only surfaced if/when they're licensed and switched on.
