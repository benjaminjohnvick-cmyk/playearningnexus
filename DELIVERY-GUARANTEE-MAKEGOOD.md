# Delivery Guarantee & Make-Good (all tiers)

*A standard ad-network delivery guarantee: the platform commits to delivering a defined volume of advertising
for each seat, and if it falls short it makes up the difference with free inventory. It guarantees the
**advertising we deliver** — never revenue or ROI. Not legal advice.*

## What it guarantees — and what it deliberately does not

The guarantee is on **delivery**: a defined volume of ad impressions the platform commits to serving for a seat
over its term. That's something the platform controls and measures on its own surfaces, so it can honor it
cleanly.

It is **not** a guarantee of the advertiser's revenue, sales, conversions, or ROI. Those depend on the
advertiser's offer, margins, and funnel — things the platform doesn't control — and promising them would be an
unsubstantiated performance guarantee, which is exactly what the FTC and payment processors flag (and what the
AI performance report is careful never to do). So the pitch is *"we guarantee your ads run — the full volume
you bought, or we make it up free,"* not *"we guarantee you'll make money."*

## The make-good

At the end of each seat's guarantee term, delivered impressions are compared to the guaranteed volume. If
delivery fell short, the platform owes a **free top-up** equal to the shortfall, delivered as extended,
no-charge inventory until the guaranteed volume is served.

It is **bounded two ways**, so it can never become a runaway liability:

- **By volume** — the free top-up can never exceed the guaranteed volume that was sold. Once cumulative
  delivery reaches the guarantee, the make-good is fulfilled and stops.
- **By time** — a granted make-good delivers for at most `DELIVERY_GUARANTEE_MAX_EXTENSION_MONTHS`, then closes
  out.

This is the compliant cousin of a revenue guarantee: the advertiser is protected on the thing that was
actually sold (the advertising), and the platform's exposure is capped at delivering what it already promised —
no more.

## How the volume is set

Each seat's guaranteed volume defaults to its tier's annual impression allotment (from the inventory governor —
Tier 1/founding = interstitial impressions/year + launch bonus; Tier 2 = impressions/year + video views/year),
scaled to the guarantee term. Admins can pin an explicit per-tier volume with
`DELIVERY_GUARANTEE_TIER1_IMPRESSIONS` / `DELIVERY_GUARANTEE_TIER2_IMPRESSIONS` (0 = derive from the allotment,
recommended). Because the guarantee is anchored to the inventory governor's allotments, the platform never
guarantees more than it can actually serve.

## Components

- `backend/sdk/delivery-guarantee.ts` — the math: `guaranteedUnits(tier)`, the pure `makeGoodStatus()`
  (delivered vs guaranteed, pacing, bounded shortfall/top-up), term helpers, and `computeSeatGuarantees()` for a
  read.
- `backend/functions/deliveryMakeGoodSweep/entry.ts` — the scheduled true-up across every active seat: grants a
  free make-good on any term-end shortfall (flags the seat to keep delivering free, records an
  `AdvertiserMakeGood`, emails the advertiser), and closes out make-goods once met or expired.
- `backend/functions/deliveryGuaranteeStatus/entry.ts` — the authenticated on-demand read: per-seat guaranteed
  vs delivered, pacing, and any active make-good and its progress.
- `backend/scheduler/schedules.json` — `daily-delivery-makegood-sweep`, daily at 11:00 UTC.
- Settings (category *Premium PPC*): `DELIVERY_GUARANTEE_ENABLED`, `DELIVERY_GUARANTEE_TERM_MONTHS`,
  `DELIVERY_GUARANTEE_GRACE_DAYS`, `DELIVERY_GUARANTEE_MAX_EXTENSION_MONTHS`, and the two volume overrides.

## How delivery is measured & served

Delivered impressions come from the seat's `impressions_served` counter — the same counter the between-survey
ad-serving path already increments (`noteFoundingImpression`). A granted make-good sets `makegood_active` and
`makegood_target_impressions` on the seat; the serving path treats make-good delivery as continued (residual)
free inventory until the target is reached. Because make-good impressions are served after paid/priority
advertisers, they use spare capacity and don't displace revenue delivery.

## Gating

Behind `DELIVERY_GUARANTEE_ENABLED` (default ON — this is a standard, compliant guarantee, unlike the
counsel-gated money-movement features). All thresholds and volumes are admin-tunable without code changes. It
tracks state only; it moves no money — a shortfall is remedied with advertising, not refunds. (A pro-rata cash
refund path already exists separately for Tier 2 prepaid deposits via `tier2-deposit.ts` if that's ever
preferred over extending delivery.)
