# Full-Value Delivery Guarantee & Advertiser Agreement

*The standing guarantee that backs every advertiser tier — Tier 1 (Founding), Tier 2 (Scaling), and Tier 3
Unlimited. This document is both the plain-English guarantee and the disclosure/agreement terms. Not legal
advice — have counsel finalize the agreement wording before it's presented to advertisers.*

## The guarantee, in one line

**You pay the full price upfront, and we deliver every dollar of the advertising you were promised — however
long it takes. We complete the delivery; we don't stop until you've received the full amount.**

This is a **make-good guarantee: we finish the delivery.** It is not a refund/money-back offer — the promise is
that you *get all the advertising you paid for*, not that you get money back.

## How it works

1. **Pay upfront.** The advertiser prepays the full package price. This is a **prepayment for advertising
   services** — not credit, not a loan, not a deposit account. Nothing is financed and nothing is owed later.
2. **We deliver the promised amount.** Each tier promises a defined dollar amount of advertising value
   (impressions and placements valued at conventional rates — Tier 1 ≈ $24k, Tier 2 ≈ $400k, Tier 3 Unlimited
   scales with the budget). Delivery is tracked on-platform against that promised amount.
3. **We keep delivering until you've received it — make-good only.** If the full promised amount hasn't been
   delivered by the end of the term, we **do not stop and we do not make you re-buy** — the make-good keeps
   serving your advertising, **free and capacity-paced, with no time cap**, until you've received every dollar of
   the advertising you were promised. (For a very large package on a growing audience this can span more than a
   year — disclosed up front; delivery accelerates as the audience grows.) The remedy is always *more delivery
   until you're made whole*, not a refund.

*(A refund backstop exists as an admin setting but ships **OFF** — the offer is make-good only. If a business
ever needs a refund path for a truly-undeliverable balance, `FULL_VALUE_GUARANTEE_REFUND_BACKSTOP` can be turned
on; it would refund only the undelivered advertising, bounded to what was paid, never a results/ROI payout.)*

## What the guarantee is — and is not

- It guarantees the **advertising we deliver**: a dollar amount of impressions/placements we measure and control
  on our own surfaces.
- It is **NOT** a guarantee of your revenue, sales, conversions, or ROI. "The dollar amount you were promised"
  always means advertising *delivered*, never money you *earned*. This is what keeps it a clean "we deliver what
  you paid for" guarantee rather than an unsubstantiated performance guarantee.
- The remedy is **more delivery until you're made whole** — a make-good, bounded by the promised volume (we
  never owe more than what was sold). Refund is not part of the offer (backstop ships off).

## Agreement terms (to be finalized by counsel)

- **Prepayment.** The advertiser pays the full price upfront; it is a prepayment for advertising services and is
  recognized as delivery occurs (unearned revenue until delivered).
- **Delivery commitment.** The platform will deliver the promised advertising volume, continuing beyond the
  initial term at no additional charge until the full promised amount is delivered.
- **Over-time disclosure.** Where the promised volume exceeds what the current audience can serve, delivery is
  paced to audience growth and may extend beyond the initial term; the advertiser receives the full amount over
  time.
- **Make-good remedy (not refund).** The sole remedy for undelivered advertising is continued delivery until the
  full promised amount is served. The offer does not include a refund; the advertiser is made whole through
  delivery. (An optional refund backstop exists in configuration but is off by default.)
- **No results/ROI guarantee.** The agreement states plainly that the guarantee covers advertising delivery
  only, not the advertiser's business results.

## Components

- `backend/sdk/full-value-guarantee.ts` — `fvgStatus()` (promised vs delivered vs remaining, in dollars),
  `fvgRefundOwed()` (bounded pro-rata refund), flags.
- `backend/sdk/delivery-guarantee.ts` — `computeSeatGuarantees` now returns each seat's `full_value_guarantee`
  dollar picture.
- `backend/functions/deliveryMakeGoodSweep` — with the guarantee on, the make-good is **deliver-until-met** (no
  time cap) for every tier.
- `backend/functions/deliveryGuaranteeStatus` — surfaces the guarantee + refund-backstop status.
- `/Apply` — a guarantee callout across all tiers; the advertiser dashboard card shows the promised-vs-delivered
  dollar amount.
- Settings (Premium PPC): `FULL_VALUE_GUARANTEE_ENABLED`, `FULL_VALUE_GUARANTEE_REFUND_BACKSTOP`,
  `FULL_VALUE_GUARANTEE_CPM_USD`.

## Gating

On by default (`FULL_VALUE_GUARANTEE_ENABLED`) — it's a pure delivery guarantee with **no money movement**: the
remedy is more advertising, not a refund. The optional refund backstop ships **OFF**
(`FULL_VALUE_GUARANTEE_REFUND_BACKSTOP = false`); if a business ever turns it on, the actual refund would run
through the platform's gated refund/payment path (processor + counsel gates), like every other refund.
