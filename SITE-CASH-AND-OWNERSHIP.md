# Site Cash, Item Ownership & 24/7 Ops — build notes

This documents the "own items with survey time" value model, its compliance reframe, and the operations
desk. It reflects what shipped in code, and why certain parts of the original spec were built differently.

## The value model: Site Cash (closed-loop, non-withdrawable)

Users earn value from surveys. That value is shown as **Site Cash** — a dollar-denominated balance that
*feels* like money and spends like money **on this site**, but is **never withdrawable** to a bank account,
debit card, checking/savings, or a P2P app (Cash App, Venmo, etc.). This is the Kohl's-Cash model: real
dollars, only spendable in-store, never cashed out.

Why non-withdrawable is the bright line: the moment earned value leaves the platform as cash into a bank
account, the business becomes a **money transmitter / stored-value issuer** (state-by-state licensing,
bonding, audits). Keeping Site Cash inside the loop is what preserves the closed-loop status. `POINTS_CASHABLE`
stays `0`. Internally, Site Cash is the existing points balance rendered as dollars (1¢/point).

Front-end helper: `src/lib/siteCash.js` (`pointsToCash`, `pointsAsCash`, `formatCash`, `SITE_CASH_NOTE`).
Displays reskinned: `UserDashboard` stats card, `PointsDisplay`, and the checkout apply button
(`ApplyPointsAtCheckout`) now lead with dollars.

## Item ownership & minutes-to-own

"Ownership %" is the share of a specific item's price a user has covered with earned Site Cash. Below 100%,
the ownership % comes off the price as a **cash discount** (spend-cap limited). At 100%, the item is fully
covered and ships to them. Ownership never becomes a cash payout.

Earn rates (admin-tunable, `backend/sdk/earn-rate.ts` + settings):

| Tier | Rate | Daily cap |
|------|------|-----------|
| Non-premium | 1.5¢/min (90¢/hr) | $8/day |
| Premium | $1.00/min (8 min → $8) | $8/day |

The calculator (`minutesToOwn`, `ownershipTable`) computes how many minutes/days of surveys it takes to own
1%…100% of an item given its price. Exposed by the `itemOwnershipPlan` function and the
`BankTowardItem` component (progress bar + milestone grid on every product card).

## Banking toward an item

Users can "bank toward" a specific item (`bankTowardItem` → `ItemSavingsGoal` entity). Progress is measured
live against their Site Cash balance (`savingsGoalStatus`), and they get a one-time "you're covered!"
notification the moment their earned Site Cash covers the price. No debt, no installments — "banking" just
sets the target the balance is measured against.

## Checkout choices (`CheckoutChoices.jsx`)

The pre-purchase screen offers, all inside the closed loop: (1) pay by card outright; (2) apply the Site
Cash you can afford now as a discount; (3) apply your max allowed Site Cash for the biggest discount; (4)
bank survey time until you own 100%; (5) reserve & keep earning (same mechanism as 4 — replaces "buy now
pay later", which is regulated consumer lending); (6) pay by card now and earn Site Cash back via surveys;
(7) choose a wait window for cheaper sourcing.

## Survey-time integrity

`backend/sdk/survey-timing.ts` scores completion time: too-fast (below `SURVEY_FRAUD_SPEEDER_SECONDS`),
interrupted mid-survey, or far below the provider's expected length → **held for review, no payout**. Wired
into `submitVerifiedSurveyResponse` (sets `is_blocked` on a flagged run). Client tracker
`src/lib/surveySession.js` enforces straight-through completion using the device's Page Visibility API —
backgrounding mid-survey marks the run interrupted; pausing is allowed only **between** surveys.

## 24/7 remote operations desk

Orders fill in batches (within 24h). Paid operators (staff/contractors) approve batches from the
`OpsConsole` page — **Y** approves the whole open batch, **N** holds. Operators run the company's *own*
fulfillment through the company's accounts; they never touch another user's funds (all ops functions are
`requireInternalOrAdmin`-gated). Coverage is scheduled via `OpsShift` (recurring UTC windows) and
`ops-shifts.ts`; `opsCoverageStatus` shows who's on now and any gap hours so the desk is never left
uncovered around the globe.

## What was intentionally NOT built (and why)

These parts of the original spec cross regulatory lines and were replaced with the closed-loop equivalents
above. Not legal advice — get counsel before launch.

- **Cash out to a debit card / bank / Cash App / any P2P.** Would make the business a money transmitter.
  Replaced with non-withdrawable Site Cash (discounts + fully-covered items).
- **Tradeable / defaultable fractional "ownership stakes"** bought, sold, or resold between users/affiliates.
  That's an unregistered security + a secondary market. Ownership here is just discount coverage, non-tradeable.
- **Selling a defaulter's stake to recoup.** Collateralized lending/repossession — not built. There is no
  debt in the model, so nothing to default on.
- **Buy Now, Pay Later.** Consumer credit (TILA + state licensing). Replaced with "reserve & keep earning".
- **Affiliates/strangers approving & purchasing other users' orders, paid in resellable fractional value.**
  Money transmission + securities + worker misclassification. Replaced with admin/staff-gated ops desk;
  operators are paid in money (normal payroll), not tradeable value.
