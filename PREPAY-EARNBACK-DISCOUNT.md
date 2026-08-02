# Prepay & Earn-Back Discount — model spec

Status: **decided, in build.** Captures every decision from the design discussion so a developer can build it
and counsel can review it. It sits on top of the existing earn-rate / percentage-checkout code
(`backend/sdk/earn-rate.ts`, `checkoutOwnershipQuote`, `itemOwnershipPlan`, `OwnershipCheckout.jsx`); the new
pieces are the **prepay plan lifecycle** and its **guardrails**.

## The mechanic (both tiers)

A member pays for an item **upfront** (the item price plus a "portion" equal to the discount they choose to
earn back), then earns that discount back over time by completing surveys. Checkout shows **no dollars** — it
shows the **discount percentage** the member picked and the **survey minutes** required to earn it. Each 1%
of the item's price converts to survey minutes at the member's tier rate.

- "Ownership %" is a **non-tradeable progress label** — how much of the item's price the member has covered
  with earned Site Cash. It is never bought, sold, or transferred between members. This keeps the model out
  of securities territory (earning comes from the member's *own* effort, not an investment that appreciates
  on others' work).
- Because the member **pays first and earns back their own activity**, no credit is extended, there is no
  loan, and there is no default. Legally this is a **rebate**, not lending — the core compliance win versus
  every earlier "front the money / recoup on default" design, all of which were rejected.

## Rates

| Tier | Credit rate | ≈ hourly | Funding reality |
|------|-------------|----------|-----------------|
| Non-premium | **1.5¢ / min** | ~$0.90/hr | Tracks real panel payout → discount is **self-funding**, ~zero cost. |
| Premium | **$1.00 / min** | ~$60/hr | Far above real payout → every discount dollar is a **real subsidy**. |

Minutes for a chosen discount = `(discount% × item_price) ÷ rate`. Example, $100 item at 50% ($50 discount):
non-premium ≈ 3,333 min (~55 hrs); premium = 50 min. **UI honesty:** show the realistic day-count next to the
minutes (a rebate whose conditions look easy but aren't is a deceptive-rebate problem).

## Caps and guardrails

- **Per-item discount cap: 50%** (both tiers) — a member always pays at least half.
- **Premium monthly discount cap: $100 / member / month** — bounds the per-member subsidy.
- **Global kill-switch: $1,000 / month** of total premium discount across ALL members; when hit, premium
  earn-back throttles until the month resets. Protects the under-$5k budget from a viral week.
- Non-premium has **no subsidy cap** (self-funding at the panel-real rate).

## Premium pricing — deliberate growth bet

- **$9.99 / month** founding price (a bounded loss-leader). **Founding window: 90 days**, then new signups
  pay the sustainable **$19.99 / month**. **Grandfather converts:** founding members roll to $19.99 at their
  next renewal. Watch the break-even share (>~10% maxing the cap → pull the conversion forward).

## Daily eligibility, missed days, quitting

- **Daily eligibility:** both tiers agree to daily survey **activity** — defined as a genuine **attempt** (not
  a guaranteed completion), so panel outages never cost a member their standing.
- **Missed day:** spends one of **3 grace/skip-days per month**; after grace, earning **pauses** until they
  resume. **Banked discount is NEVER clawed back.**
- **Quitting an item:** the unearned prepaid portion **converts to Site Cash** (closed-loop). See stored-value note.

## Legal posture

- **Not lending** (paid upfront, no credit/default). **Not securities** (own-effort discount; "ownership %"
  non-tradeable). **Rebate** with clear point-of-sale disclosure. **Closed-loop** (Site Cash non-withdrawable).

## Two items that need counsel before launch

1. **Attempt-based daily requirement** — define "daily activity" as an attempt, not a completion, in code and
   disclosure.
2. **Quit → Site Cash = stored value** — several US states regulate it (non-expiring balances, escheatment).
   The Site Cash issued on a quit must be non-expiring/long-dated with a stored-value policy sign-off, OR
   refund the unearned portion to the original payment method instead.

## Build map

- **Settings** (`settings.ts`): `EARNBACK_*` (per-item cap, premium monthly cap, global kill-switch, grace-days,
  founding/after price, founding-window days, daily-attempt minutes).
- **SDK** `earn-back.ts`: caps, kill-switch counter, grace/eligibility, founding pricing, unearned→Site-Cash.
- **Entity** `EarnBackPlan` (owner). **Functions:** `earnBackStart`, `earnBackCredit`, `earnBackStatus`,
  `earnBackAbandon`. **Frontend** `EarnBackPlanPanel.jsx` (%+minutes, honest day-count, progress, grace, paused).
