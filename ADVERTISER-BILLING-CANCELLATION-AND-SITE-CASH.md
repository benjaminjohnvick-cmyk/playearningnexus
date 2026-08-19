# Advertiser Billing, 30-Day Cancellation & Site-Cash Auto-Apply

*Three related changes: how advertisers are billed (52 weeks prepaid, 13 four-week cycles), a 30-day
proportional cancellation right, and automatic application of Site Cash to purchases. Admin-tunable. Not legal
advice — have counsel finalize the cancellation/disclosure wording before it's shown to advertisers.*

## 1. Billing — full 52 weeks prepaid up front, tracked in 13 four-week cycles (all tiers)

Every advertiser tier (Tier 1 Founding, Tier 2 Scaling, Tier 3 Unlimited) **prepays the full year (52 weeks) in
one upfront charge** at signup, through the normal checkout/processor. This is a single **prepayment for
advertising services** — it is **not** credit, **not** an installment plan, and **not** a recurring auto-charge.
Nothing is billed later and nothing is owed later.

The prepaid year is then **tracked and reported as 13 four-week cycles** (13 × 28 days = 364 days ≈ 52 weeks).
Cycles are an accounting / delivery-pacing lens — how the prepayment is recognized as revenue and how delivery
paces across the year — **not** 13 separate charges.

- `backend/sdk/billing-schedule.ts` — `annualPrepayAmount(tier)`, `cycleLadder(annualUsd, termStart)` (13 equal
  cycles, last absorbs rounding so the cumulative hits the exact annual amount), `billingScheduleStatus(...)`
  (which cycle you're in, how much of the prepay is recognized, whether the year is complete).
- `backend/functions/billingScheduleStatus` — the advertiser's live billing picture for their seat/plan.
- Settings (**Advertiser Billing**): `BILLING_ANNUAL_PREPAY_ENABLED` (on), `BILLING_CYCLES` (13),
  `BILLING_CYCLE_DAYS` (28).
- **Money boundary unchanged:** these functions compute/report only. The actual upfront collection runs through
  the existing `card_charging`-gated checkout, exactly like the other advertiser flows ("does not move money").

## 2. 30-day proportional cancellation (cooling-off)

Within **30 days** of purchase, an advertiser may cancel and receive a **proportional refund: we keep two-thirds
and refund one-third** of what they paid. For a Tier 1 $12,000 package that is **keep $8,000, refund $4,000**;
Tier 2 ($200,000) is keep $133,333.33 / refund $66,666.67; Tier 3 scales with the budget paid.

- The refund is issued as **closed-loop site refund credit** (`refund_credit_balance`), consistent with
  `REFUND-POLICY.md` — never a cash or card refund (that path stays gated off).
- The kept two-thirds is **non-refundable** and is **disclosed up front**: the endpoint returns the exact
  keep/refund split as a preview and records a `ConsentRecord` (`kind: "advertiser_cancellation"`) capturing
  exactly what was shown before it acts.
- Cancelling sets the seat/plan `status` to `cancelled`, which **frees its inventory reservation** (the
  inventory governor drops non-active/cancelled rows) so the seat returns to the sellable pool.

### How it relates to the Full-Value Delivery Guarantee (they coexist; both stay on)

They are **independent switches** and answer different questions:

- **30-day cancellation** = a time-boxed **cooling-off exit** keyed to the *purchase date*. A partial money-back,
  independent of how much advertising we've delivered.
- **Full-Value Delivery Guarantee** = a **delivery** promise keyed to *undelivered advertising*. It governs
  **after** the 30-day window: we keep delivering the advertising you paid for until it's met (make-good only;
  refund backstop ships OFF). The cancellation does **not** read or flip the guarantee's refund backstop.

So: within 30 days → optional proportional cancellation. After 30 days → the guarantee (deliver-until-met).

- `backend/sdk/advertiser-cancellation.ts` — `cancellationQuote({ paidUsd, purchasedAtISO, nowMs })`.
- `backend/functions/advertiserCancel` — preview (default) or `{ confirm: true }` to execute.
- Settings (**Advertiser Billing**): `ADVERTISER_CANCELLATION_ENABLED` (on),
  `ADVERTISER_CANCELLATION_WINDOW_DAYS` (30), `ADVERTISER_CANCELLATION_REFUND_PCT` (0.3333… = refund one-third;
  `sensitive`, since it authorizes a refund).

## 3. Site Cash auto-applies to purchases (every checkout) — and each buyer controls it

**Site Cash = a buyer's `points` balance rendered as dollars (1¢/point), closed-loop and non-cashable.** At
checkout it **auto-applies** to reduce what the buyer pays, so they don't have to opt in each time. It **only
offsets a purchase** and is never withdrawn as cash. Every other payment option (full points, card, store credit,
refund credit) is unchanged — auto-apply just lowers the card/real-money remainder.

**Each buyer sets it themselves.** The auto-apply behavior is a per-user preference (`auto_apply_site_cash` on the
User) that **overrides** the site-wide default. `backend/functions/setSiteCashAutoApply` reads/sets/clears it
(`{ auto_apply: true|false }` or `{ reset: true }`); `resolveSiteCashAutoApply(user)` returns the buyer's
preference, or the site default (`SITE_CASH_AUTO_APPLY`) when they haven't set one.

**Bounds (same as manual apply):** never more than the purchase total, never more than the per-transaction spend
cap (`maxPointsPerTransaction` — 12% non-premium / 24% premium of balance, the reserve guard), never more than the
buyer holds. Shared, tested math in `siteCashApplyPlan({ faceUsd, userPoints, isPremium })`.

**Coverage across checkouts:**

- **Server-authoritative card paths — fully automatic, no frontend change:** `hybridCheckout` and
  `purchaseMarketplaceListing` (card). Site Cash is deducted and the money-flow recorded on the server, and the
  card is charged only the reduced remainder (the points value is fronted to fulfillment via the business
  account, exactly like the existing hybrid flow). Honors the per-user preference.
- **Client-captured card paths (e.g. `placeStoreOrder`):** because those flows capture the card **on the client**
  for the amount they compute, the UI must first call **`checkoutSiteCashQuote`** (`{ price_usd }` → returns
  `points_applied` / `points_usd` / `card_after_usd`, honoring the buyer's preference), charge the
  `card_after_usd`, and pass it through. This one small hook makes auto-apply work on those checkouts too without
  ever under-collecting. (Backend endpoint is ready; the store checkout component needs to call it — a quick
  follow-up.)
- Settings: `SITE_CASH_AUTO_APPLY` (site default, **Economy & Payouts**); per-user override via
  `setSiteCashAutoApply`.

## Compliance spine (unchanged)

Prepay = prepayment (recognized as delivery/time elapses), never a return/revenue/ROI promise. Recurring
auto-charge was intentionally **not** built (the chosen model is one upfront prepayment) — so no negative-option
/ auto-renew exposure. The cancellation's non-refundable portion is disclosed and consented before it applies,
and its refund runs as closed-loop credit through the same policy as every other advertiser refund. Site Cash
stays closed-loop and non-cashable. Tests: `deno test backend/sdk/{billing-schedule,advertiser-cancellation,site-cash-apply}.test.ts`.
