# Growth Engine — self-sustaining growth on real cash, with a redemption reserve

**What it is.** An admin engine that models the growth flywheel you described: real outside cash comes in
(advertisers, subscriptions, spreads), you issue closed-loop points as the engagement currency, and you
recapture a large share of that point value through **breakage** (points never redeemed) and **spread**
(redeemed points buy catalog goods where you keep face − wholesale). The free surplus is split between
**reinvestment into growth** and **profit**. Flip the loop off (or hit a max-users target) and 100% of the
free surplus becomes take-home profit.

**Why it isn't a scheme.** Growth is funded by **operations/advertising cash, never by new users' money**,
and **nothing converts points to cash**. Points stay non-cashable closed-loop credit — that's the
money-transmission shield, and it's also what makes breakage real. The owner's money is the real
advertiser/operations cash plus recaptured breakage/spread, which are already the platform's.

## The guardrail (the thing you asked for)

Before any dollar is called profit or reinvested, the engine **reserves** enough cash to honor the points it
expects to be redeemed — at what they cost *you* (wholesale, not face) — plus a safety buffer:

```
reserve = outstanding_points × expected_redemption_rate × point_value × wholesale_fraction × (1 + safety_buffer)
free_surplus = max(0, estimated_cash − reserve)
```

If `estimated_cash < reserve`, the engine reports a **shortfall**, sets `reinvest = 0`, and tells you to top
up the reserve before any new marketing. It will **never** recommend spending money you owe to points.
(Verified: under-reserved → reinvest 0; funded → reinvest = reinvest_pct × free surplus; loop off / max-users
hit → all free surplus becomes profit.)

## What's wired

- **`backend/sdk/growth-engine.ts`** — pure, deterministic math: reserve, recognized breakage, spread
  recapture, capture rate, CAC/LTV/payback, reinvest-vs-profit split, and a month-by-month projection.
- **`growthBudgetReport`** (admin) — assembles every number from the real ledgers: `RevenueEvent`
  (revenue vs subsidy), `Expense`, `User.points` (outstanding liability), and points `Order`s (redemptions).
- **`recordExpense`** (admin) + **`Expense`** entity — log marketing / infra / AI / ops spend (marketing
  drives CAC).
- **`growthBudgetAutoPlan`** (scheduled daily, 08:20 UTC) — stores a dated **`GrowthPlan`** snapshot, raises
  an `AdminAuditLog` alert when the reserve is underfunded, and writes a short plain-English recommendation
  (cheap AI tier; the numbers are computed, the AI only narrates them).
- **`GrowthEngine`** admin page — reserve status front-and-center, the money split (cash / reserve /
  reinvest / profit), recapture + unit economics, a 12-month projection, and an expense-logging form.

## Knobs (Settings → Growth)

`EXPECTED_REDEMPTION_RATE` (0.6, used before there's real redemption history), `GROWTH_RESERVE_SAFETY_PCT`
(0.15), `GROWTH_REINVEST_PCT` (0.7 of free surplus), `GROWTH_LOOP_ACTIVE` (on = reinvest; off = "break the
loop," take all free surplus as profit), `GROWTH_LTV_YEARS` (3), `GROWTH_MAX_USERS_TARGET` (0 = no cap; else
stop reinvesting once reached).

## Honest caveats

- **`estimated_cash_usd` is an estimate** from the recorded revenue/expense ledgers — reconcile it against
  your real bank balance. The engine is only as accurate as the expenses you log.
- **Breakage isn't always fully free:** several U.S. states have unclaimed-property/escheatment law that can
  claim part of breakage. The recognition rate is deliberately conservative; confirm the number with your
  accountant.
- **Not financial or legal advice.** Put the growth-and-payout design (and any user-facing "earn and cash
  out" language) in front of a securities/fintech attorney before it ships.
