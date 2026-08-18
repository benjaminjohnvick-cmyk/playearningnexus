# Tier 2 Value Stack — "$200,000 → $400,000 in advertising value"

*The same compliant 2× framing as Tier 1, at the Tier 2 "Scale" price: the advertiser pays $200,000 and
receives at least $400,000 of **advertising value** — the A–D rate card at conventional market rates — with the
impression portion backed by the delivery guarantee. It is not a promise of a $400,000 return, revenue, or ROI.
Not legal advice.*

## The reframe (why it's "value," not "return")

A "$400,000 return on $200,000" would be a guaranteed-ROI claim — unmeasurable off-platform, an unbounded
liability, and an FTC/processor red flag, and the exposure is higher at a six-figure ticket. So the $400,000
lives entirely on the **value-delivered** side: it's the conventional market value of the advertising actually
delivered (media, creative, research, managed service), not a claim about the advertiser's sales. Buyers still
hear "put in $200k, get $400k," but it's $400k of advertising value the platform controls and guarantees to
deliver — never $400k of their revenue.

## How $400k is reached — honestly (balanced mix)

Tier 2 already itemized ~$282,400 of deliverables bundled at $200,000 (~1.4×). To reach a conservative 2× we
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
| **Rate-card list value** | **~$282,400** | **~$404,300 (2.02×)** |

Because the itemized lines already total **$404,300**, the 2× claim is met by real advertising with no synthetic
top-up. The delivery-driving settings were bumped in lockstep (`TIER2_IMPRESSIONS_PER_YEAR` 3M→5M,
`TIER2_VIDEO_VIEWS_PER_YEAR` 500k→1M, plus the research/service quantities), so what's *valued* is exactly what's
*delivered* and *guaranteed*.

## Backed by the delivery guarantee + value-match

The impression lines are guaranteed: the all-tiers delivery guarantee already covers Tier 2, so any
under-delivery is made good with free inventory (bounded by volume and time). And if an admin ever trims the
rate card below the $400k target, the stack sizes a block of **guaranteed value-match impressions** (real
advertising at the CPM) to close the gap — folded into `guaranteedUnits("tier2")` — rather than inflating a
rate. So the advertised $400k is always actually backed.

## Components

- `backend/sdk/tier2-value-stack.ts` — `tier2ValueStack()` (rate card + target + value-match + multiple) and
  `tier2ValueMatchBonusImpressions()`.
- `backend/sdk/ai-ad-manager.ts` — the A–D `CATALOG` / `rateCard()` (now ~$404k list).
- `backend/sdk/delivery-guarantee.ts` — `guaranteedUnits("tier2")` includes the value-match bonus.
- `backend/functions/tier2ValueStack/entry.ts` — read endpoint for `/Apply` and dashboards.
- Settings (Tier 2 Scaling): `TIER2_VALUE_STACK_ENABLED`, `TIER2_VALUE_MULTIPLE_TARGET`, `TIER2_VALUE_TARGET_USD`,
  `TIER2_VALUE_CPM_USD`, plus the bumped quantity settings.

## Positioning language (safe)

Say: *"Your $200,000 gets you over $400,000 in advertising value — media, research, creative, and managed
service at standard rates — and we guarantee the delivery."* Never: *"a $400,000 return,"* *"double your
money,"* or anything tying the number to the advertiser's revenue or ROI.
