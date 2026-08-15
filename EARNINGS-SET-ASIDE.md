# Earnings Set-Aside — "save part of what you earn" (user-controlled, no debt)

*A voluntary button on the Tier 1 and Tier 2 offer pages that lets a user earmark a share of their OWN
earnings (closed-loop, non-cashable Site Cash) into a separate bucket to spend later — on their ad plan or
anything else. The user picks the amount; it's off by default; nothing is ever owed or locked. Not legal
advice.*

## What the user asked for

A clearly-labeled button on the Tier 1 and Tier 2 offers that lets users choose how much (if any) of their
earnings to set aside to pay for other things — their choice, explained right on the label.

## How it works

- **The user picks the percentage.** A control offers Off / 10% / 25% / 50% (up to `EARNINGS_SETASIDE_MAX_PCT`).
  From then on, that share of each new earning is moved from spendable into their set-aside bucket. **Default
  is 0% (off)** — nothing is set aside unless the user turns it on.
- **It's their own money the whole time.** Both the spendable balance and the set-aside bucket are the user's
  closed-loop Site Cash. Setting aside just parks it in a second bucket; it never becomes a payment to us and
  never leaves the closed loop.
- **Move money now, or move it back.** The user can move a specific amount into the bucket immediately, and
  can release any or all of it back to spendable at any time. This is what proves the promise: **nothing is
  locked and nothing is owed** (`amount_owed` is always $0).
- **Spend it on anything.** The set-aside bucket funds their Tier 1 self-paced payments, Tier 2 parts, or any
  other on-platform purchase — it's ordinary Site Cash they chose to save.

## Why it's compliant

- **Not credit.** No fixed amount is owed and nothing is deferred — the user is only ever moving their own
  already-earned store credit between two of their own buckets. There is no borrower, no balance, no recourse.
- **Not an automatic debt-sweep.** Contrast the gated `tier1_financed` product, which sweeps earnings toward a
  $12,000 *debt*. Here there is no debt to sweep toward; the set-aside is the user's savings, reversible at will.
- **No money-transmission surface.** The credit stays non-cashable and closed-loop; setting it aside doesn't
  make it cashable and doesn't move value to anyone else.

Because it raises none of those issues, the `earnings_setaside` flag defaults **ON** (it's still off per-user
until each user opts in).

## Where it lives in code

- Flag: `earnings_setaside` (default ON) — `backend/sdk/feature-flags.ts`.
- Setting: `EARNINGS_SETASIDE_MAX_PCT` (1 = up to 100%) — category "Earnings Set-Aside".
- Model: `backend/sdk/earnings-setaside.ts` — config, `setAsideStatus`, `clampPct`, `applyEarningSetAside`
  (the split helper), `setAsideDisclosures`. Balances move via `adjustUserBalance` between the User fields
  `current_balance` (spendable) and `setaside_balance_usd` (bucket); the chosen share is `earnings_setaside_pct`.
- Functions: `earningsSetAsideStatus` (read), `earningsSetAsideSetPct` (choose the %), `earningsSetAsideMoveNow`
  (move an amount into the bucket now), `earningsSetAsideRelease` (move any/all back to spendable).
- UI: `src/components/EarningsSetAsideButton.jsx` — a self-explaining, collapsible control. Mounted on the
  Tier 1 offers (`/Tier1SelfPaced`, `/FoundingAdvertiser`) and the Tier 2 offer (`/Tier2Scaling`). Drop
  `<EarningsSetAsideButton />` onto any other page to offer it there too.

## One integration point (for the auto-split)

The percentage takes effect on **new** earnings via `applyEarningSetAside(userId, earningUsd)`. Call it right
after crediting a user's earnings (e.g. survey payout) with the amount just credited — it re-buckets the
user's chosen share. Until that one line is wired at your earnings-credit site, the button is still fully
usable: users set their %, move amounts into the bucket now, and release them — all live. The auto-split is
purely a convenience so they don't have to move it manually each time.
