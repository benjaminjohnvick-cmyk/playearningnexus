# Premium, financed from earnings — model spec

Status: **decided, in build.** Lets a member get Premium with **no upfront payment** — the subscription is
paid down at $1/day out of earned Site Cash, and any overpayment comes back at month's end. Companion to
PREPAY-EARNBACK-DISCOUNT.md (this is how the premium tier gets *paid for*).

## The mechanic

1. **No upfront charge.** On enroll, Premium is granted immediately and a 30-day finance cycle starts.
2. **$1/day from earnings.** Each day the member earns, **$1 is deducted from their Site Cash** (never pushing
   the balance negative — earn nothing that day, deduct nothing). That day's earnings also count toward the
   monthly total.
3. **Membership "covered"** once cumulative deductions reach the price — $19.99 (~20 earning days) or $9.99
   founding (~10 days).
4. **Cycle close (day 30):**
   - **Excess always returns as Site Cash.** `excess = max(0, deducted − price)`. A full 30-day month → $30
     deducted − $19.99 = **$10.01 back**, returned regardless of the streak.
   - **Successful month = the monthly total** (default ~$216 = $8/day × 27 days) — a recognition flag; the
     refund is independent of it.
   - **Covered → renews.** **Not covered → downgrade to free** (partial deductions stand as payment for access
     used; no debt, no clawback, no collection).

Site Cash is non-withdrawable throughout.

## Numbers

| Member price | Earning days to cover | Excess after a full 30-day month |
|--------------|-----------------------|----------------------------------|
| $19.99 (sustainable) | ~20 days | ~$10.01 back as Site Cash |
| $9.99 (founding)     | ~10 days | ~$20.01 back as Site Cash |

## Compliance posture

- **Not lending** — nothing is fronted; under-earning downgrades to free; no debt, negative balance, or
  collection. **Closed-loop** — deductions/refunds move rewards, not bank cash. **No forfeiture** — the excess
  always returns. **Disclosure at enroll** (plain language: what's held, what returns, what happens if you stop).

## Economic note — read this

Financing Premium from earnings means the tier brings in **no external cash** (the $19.99 is paid in the
member's own Site Cash). So the earn-back subsidy is no longer offset by subscription revenue — the tier now
leans on your **real survey margin**. Fine *if* an $8/day member truly generates ~$4/day of real cash; a
problem if $8/day is credited but the panels pay a fraction. **Confirm real BitLabs payout math** before
leaning on this, against the under-$5k budget and the $1,000/month premium kill-switch.

## Build map

- **Settings** `PREMIUM_FINANCE_*` (enabled, $1/day, 30-day cycle, $216 monthly target); price from
  `premiumPricing()`.
- **SDK** `premium-finance.ts` (daily amount, cycle math, coverage, excess, cycle-close outcome).
- **Entity** `PremiumFinancePlan` (owner). **Functions:** `premiumFinanceStart`, `premiumFinanceDaily`
  (daily cron: deduct + close → refund excess, qualify, renew or downgrade), `premiumFinanceStatus`.
- **Frontend** `PremiumFinancePanel.jsx`. **Cron:** `premiumFinanceDaily` runs once daily.
