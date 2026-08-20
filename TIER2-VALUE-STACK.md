# Tier 2 Value Stack — "$216,666.67 → $433,333 in advertising value"

*The same compliant 2× framing as Tier 1, at the Tier 2 "Scale" price: the advertiser pays $216,666.67 and
receives at least $433,333 of **advertising value** — the A–D rate card at conventional market rates — with the
impression portion backed by the delivery guarantee. It is not a promise of a $433,333 return, revenue, or ROI.
Figures reflect **13-period (four-week) pricing** (`BILLING_13_PERIOD_PRICING`, default ON): Tier 2's annual is
13 four-week periods = **$216,666.67** (billed as 13 four-week cycles, never "monthly"). Toggle it OFF for the
12-month **$200,000 → $400,000**.
Not legal advice.*

## The reframe (why it's "value," not "return")

A "$433,333 return on $216,666.67" would be a guaranteed-ROI claim — unmeasurable off-platform, an unbounded
liability, and an FTC/processor red flag, and the exposure is higher at a six-figure ticket. So the $433,333
lives entirely on the **value-delivered** side: it's the conventional market value of the advertising actually
delivered (media, creative, research, managed service), not a claim about the advertiser's sales. Buyers still
hear "put in $216.7k, get $433k," but it's $433k of advertising value the platform controls and guarantees to
deliver — never $433k of their revenue.

## How $433k is reached — honestly (balanced mix)

Tier 2 already itemized ~$282,400 of deliverables bundled at $216,666.67 (~1.3×). To reach a conservative 2× we
raised the A–D rate card with a **balanced mix of real deliverables** — more media *and* more research/service —
each at a defensible conventional rate:

| Line | Was | Now |
|---|---|---|
| Between-survey impressions | 3.0M/yr ($66k) | **5.0M/yr ($110k)** |
| Rewarded video views | 500k/yr ($9k) | **1.0M/yr ($18k)** |
| Homepage featured / sponsor wall | $24k | **$30k** |
| Managed creative + social + email + newsletters | $45k | **$67.5k** |
| Audience panels | 4/yr ($48k) | **5/yr ($60k)** |
| Brand-lift studies | 2/yr ($12k) | **3/yr ($18k)** |
| Competitive reports | 4/yr ($10k) | **6/yr ($15k)** |
| Data feed + analytics + A/B + AI campaign mgr | $68.4k | **$85.8k** |
| **Rate-card list value** | **~$282,400** | **~$404,300 (~1.87×)** |

The itemized A–D rate card totals **~$404,300** (~1.87× of the 13-period $216,666.67 price). To hold the full
**2× ($433,333)**, the stack adds a bounded block of **guaranteed value-match impressions** (~1.3M impressions at
the conventional CPM) on top — real advertising, folded into `guaranteedUnits("tier2")`, never an inflated rate.
The delivery-driving settings back the rate card in lockstep (`TIER2_IMPRESSIONS_PER_YEAR` 3M→5M,
`TIER2_VIDEO_VIEWS_PER_YEAR` 500k→1M, plus the research/service quantities), so what's *valued* is exactly what's
*delivered* and *guaranteed*. (With 12-month pricing — `BILLING_13_PERIOD_PRICING` off — the price is $200,000,
the target $400,000, and the rate card alone meets 2× with no value-match needed.)

## Backed by the delivery guarantee + value-match

The impression lines are guaranteed: the all-tiers delivery guarantee already covers Tier 2, so any
under-delivery is made good with free inventory (bounded by volume and time). And if an admin ever trims the
rate card below the $433k target, the stack sizes a block of **guaranteed value-match impressions** (real
advertising at the CPM) to close the gap — folded into `guaranteedUnits("tier2")` — rather than inflating a
rate. So the advertised $433k is always actually backed.

## Components

- `backend/sdk/tier2-value-stack.ts` — `tier2ValueStack()` (rate card + target + value-match + multiple) and
  `tier2ValueMatchBonusImpressions()`.
- `backend/sdk/ai-ad-manager.ts` — the A–D `CATALOG` / `rateCard()` (now ~$404k list).
- `backend/sdk/delivery-guarantee.ts` — `guaranteedUnits("tier2")` includes the value-match bonus.
- `backend/functions/tier2ValueStack/entry.ts` — read endpoint for `/Apply` and dashboards.
- Settings (Tier 2 Scaling): `TIER2_VALUE_STACK_ENABLED`, `TIER2_VALUE_MULTIPLE_TARGET`, `TIER2_VALUE_TARGET_USD`,
  `TIER2_VALUE_CPM_USD`, plus the bumped quantity settings.

## Positioning language (safe)

Say: *"Your $216,666.67 gets you over $433,333 in advertising value — media, research, creative, and managed
service at standard rates — and we guarantee the delivery."* Never: *"a $433,333 return,"* *"double your
money,"* or anything tying the number to the advertiser's revenue or ROI.
