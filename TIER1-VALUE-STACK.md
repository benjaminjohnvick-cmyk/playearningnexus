# Tier 1 Value Stack — "$13,000 → $26,000 in advertising value"

*The compliant way to headline a 2x on the Tier 1 / founding offer: the advertiser pays $13,000 and receives at
least $26,000 of **advertising value** — real, delivered advertising valued at conventional market rates, with
the impression portion backed by the delivery guarantee. It is not a promise about the advertiser's revenue,
sales, or ROI. Not legal advice.*

> **Pricing note:** figures reflect **13-period (four-week) pricing** (`BILLING_13_PERIOD_PRICING`, default ON) —
> Tier 1's annual is 13 four-week periods = **$13,000** (billed as 13 four-week cycles, never "monthly"). With
> that toggle OFF the price reverts to the 12-month **$12,000 → $24,000**. Everything below scales with the price.

## Why it's built this way

"Free ads until you earn $26,000" and "$13k → $26k in advertising value" sound similar but are opposites in
compliance terms. The first ties the offer to the advertiser's **revenue** — an outcome the platform doesn't
control, can't reliably measure off-platform, and would owe against with no natural cap. That's an
unsubstantiated performance guarantee (an FTC and payment-processor red flag) with an unbounded liability.

This stack keeps the same $26k headline but puts it entirely on the **value-delivered** side. The $26,000 is the
conventional market value of the advertising the advertiser actually receives — impressions, placements,
creative, managed service — none of it a claim about what they'll earn. That makes it:

- **Substantiated** — every line is a real deliverable at a defensible conventional rate (it mirrors the Tier 2
  rate card, which lists ~$282k of deliverables and bundles at the $200k price).
- **Measurable** — the impression lines are served and counted on-platform.
- **Bounded** — a fixed stack of advertising, not an open-ended obligation tied to someone's sales.
- **Backed** — the impression lines are guaranteed by the delivery guarantee / make-good: if the platform
  under-delivers them, it tops them up with free inventory (capped at what was promised).

## What's in the stack (default)

At default settings the included lines total about **$28,500 ≈ 2.19×** the $13,000 price:

| Line | Conventional value | Guaranteed |
|---|---|---|
| Between-survey impressions (200,000/yr) | ~$4,400 | ✅ delivery-guaranteed |
| Launch-bonus impressions (100,000, one-time) | ~$2,200 | ✅ delivery-guaranteed |
| Managed social ad posts (360/yr) | ~$4,500 | — |
| AI ad-creative production | $3,000 | — |
| Always-on AI campaign manager + optimization | $3,000 | — |
| Automatic A/B testing | $2,000 | — |
| Analytics & attribution dashboard | $2,400 | — |
| Consumer-sentiment insights | $1,800 | — |
| Featured placement + sponsor-wall | $3,000 | — |
| Priority concierge support | $1,200 | — |
| Premium membership included | $1,000 | — |

Every value is admin-tunable (`TIER1_VALUE_*` settings, or a full `TIER1_VALUE_CARD_JSON`-style override per
line), and each feature line respects its existing on/off toggle, so the stack always reflects what's actually
delivered.

## The value-match guarantee (holding the 2x honestly)

If the honestly-valued included lines ever fall **below** the target (default 2× = $26,000) — because an admin
trims values or turns features off — the stack does **not** inflate a rate to hit the number. Instead it sizes a
block of **guaranteed value-match impressions**, valued at the conventional CPM, to close the gap: the platform
delivers *more real advertising* rather than quoting a bigger number. Those value-match impressions are added to
the Tier 1 volume the **delivery guarantee** guarantees (`guaranteedUnits("tier1")`), so the advertised $26,000
is genuinely backed by delivery + make-good, not just asserted.

## Components

- `backend/sdk/tier1-value-stack.ts` — `tier1ValueStack()` (itemized lines, included value, value-match bonus,
  total, multiple, target) and `tier1ValueMatchBonusImpressions()`.
- `backend/sdk/delivery-guarantee.ts` — `guaranteedUnits("tier1")` now includes the value-match bonus, so the
  delivery guarantee backs the stacked value.
- `backend/functions/tier1ValueStack/entry.ts` — read-only endpoint exposing the itemized stack for the `/Apply`
  page and the advertiser dashboard.
- Settings (category *Founding Advertiser*): `TIER1_VALUE_STACK_ENABLED`, `TIER1_VALUE_MULTIPLE_TARGET`,
  `TIER1_VALUE_TARGET_USD`, `TIER1_VALUE_CPM_USD`, and the per-line value settings.

## Positioning language (safe)

Say: *"Your $13,000 gets you over $26,000 in advertising value — impressions, placements, creative, and managed
service at standard rates — and we guarantee the delivery: if we fall short, we make it up free."*

Never say: *"you'll earn $26,000,"* *"double your money,"* *"guaranteed 2x return,"* or anything tying the
number to the advertiser's revenue or ROI. The number describes advertising delivered, not money made.
