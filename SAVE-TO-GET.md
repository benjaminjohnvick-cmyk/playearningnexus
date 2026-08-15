# Save-to-Get — save toward an item from your own earnings (no debt)

*The no-debt replacement for Goods Advance. The user reserves their OWN closed-loop Site Cash toward a chosen
item and claims it when funded; canceling returns the savings. No advance, no balance owed, no repayment — so
not credit. Not legal advice.*

## What the user asked for (via the set-aside pattern)

Let people "use their earnings over time to get goods" — but without extending credit. The set-aside pattern
makes that safe: the user pays into a reservation from money they've already earned, receives the item once
it's funded, and can pull the reservation back anytime. They pre-pay from their own Site Cash instead of
being advanced goods and repaying — so there is nothing to repay.

## How it works

- **Create a goal** for any item (name + price), optionally with an auto-save % of new earnings.
- **Add savings** at your own pace, or let the auto-% route a share of new earnings in. It's your own
  spendable Site Cash moved into a reservation.
- **Claim** when saved ≥ price — the item is fulfilled through the normal order flow, paid entirely from your
  savings.
- **Cancel anytime** → your reserved savings move straight back to spendable. Nothing owed, nothing lost.

## Why it's not credit

No value is advanced and no balance is ever owed: the user only ever spends money they already earned, and can
reclaim it until they claim the item. That's layaway/savings, not a loan (contrast the gated `goods_advance`,
which advances goods and recovers from earnings = credit). It stays closed-loop and non-cashable throughout.

## Where it lives in code

- Flag: `save_to_get` (ON). Settings: `SAVE_TO_GET_MAX_GOALS` (10), `SAVE_TO_GET_MIN_PRICE_USD` (1).
- Model: `backend/sdk/save-to-get.ts` — config, `goalView`, `activeGoals`, `applyEarningToGoals` (auto-route
  helper), `saveToGetDisclosures`. Reserved funds move via `adjustUserBalance` on `current_balance`.
- Entity: `SaveToGetGoal` (owner-scoped).
- Functions: `saveToGetStatus`, `saveToGetCreate`, `saveToGetContribute`, `saveToGetClaim`, `saveToGetCancel`.
- Page: `/SaveToGet`.
- Integration point: call `applyEarningToGoals(userId, earningUsd)` right after crediting earnings to auto-route
  the user's chosen per-goal %. Until wired, users add savings manually — fully functional either way.
- Retires the gated `goods_advance` for good.
