# Tier 2 Plus — Uncapped Scaling Above $200k

*An open-ended scaling tier above the $200,000 Tier 2 base: an advertiser names any budget they can afford and
the package scales proportionally, keeping the same conservative ~2× value ratio. Same compliance spine as Tier
1/Tier 2 — advertising value delivered, never a return. Not legal advice.*

## What it is

Tier 2 tops out as a fixed $200,000 "Scale" package. **Tier 2 Plus** removes the ceiling: an advertiser scaling
above $200k/yr can go **as big as they want and can afford**. They name a budget at or above the base, and the
whole A–D rate card scales **proportionally** — more between-survey impressions, more rewarded video, more
audience panels and brand-lift studies, more managed creative/social/email, more campaign management — so the
delivered advertising value stays at the same **~2×** ratio ("$X buys ~$2X in advertising value").

| Budget | Scale | Advertising value (~2×) | Guaranteed impressions/yr |
|---|---|---|---|
| $200,000 (base) | 1× | ~$404,300 | 6,000,000 |
| $400,000 | 2× | ~$808,600 | 12,000,000 |
| $1,000,000 | 5× | ~$2,021,500 | 30,000,000 |

## The two guardrails (how "as big as they want and can afford" stays safe)

- **"As big as they can afford" = prepaid, upfront.** Tier 2 Plus is paid upfront (closed-loop spine) — it is
  **not credit, not a loan, not money transmission**. Affordability is enforced by payment, not by extending
  credit. (The money side reuses the existing Tier 2 deposit/prepay machinery, which stays counsel-gated.)
- **"As big as they want" = capacity-paced, never oversold.** However large the buy, the full allotment is
  **guaranteed as a total over the term and delivered as the audience grows** (the inventory governor's
  capacity-paced mode). We never promise a volume the audience can't eventually serve, and the **delivery
  guarantee** backs it: if we under-deliver the guaranteed volume, we make it up with free inventory (bounded).

## Compliance framing (unchanged from Tier 1/Tier 2)

The scaled number is **advertising VALUE delivered** at conventional rates — never a claim about the
advertiser's revenue, sales, or ROI. There is no "return" language anywhere. Larger tickets get more scrutiny,
so the same substantiation and no-guarantee rules apply, only more so.

## Components

- `backend/sdk/tier2-plus.ts` — `tier2PlusQuote(budgetUsd)` (scaled deliverables + ~2× value + guaranteed
  impressions + capacity-paced/prepaid), `tier2PlusEnabled()`, `tier2PlusMinUsd()`, `tier2PlusMaxUsd()`.
- `backend/functions/tier2PlusQuote/entry.ts` — the read/preview endpoint (budget → scaled quote).
- `backend/sdk/delivery-guarantee.ts` + `deliveryMakeGoodSweep` — now honor a per-plan
  `guaranteed_impressions_per_year`, so a Plus seat's custom guaranteed volume is backed by the make-good.
- `/Apply` — a Tier 2 Plus card with a budget input and a live scaled-value preview.
- Settings (Tier 2 Scaling): `TIER2_PLUS_ENABLED`, `TIER2_PLUS_MIN_USD` ($200k floor), `TIER2_PLUS_MAX_USD`
  (0 = uncapped).

## Acceptance / billing

Quoting and surfacing are live (this spec). Charging a Tier 2 Plus package reuses the Tier 2 upfront-deposit
flow — the advertiser prepays, the plan is created with its `guaranteed_impressions_per_year` stamped (so the
delivery guarantee backs it), and delivery runs capacity-paced. Real money movement stays behind the same
processor + counsel gates as every other paid feature.

## Positioning language (safe)

Say: *"Scale as big as you want — your budget buys proportionally more advertising, at about 2× value, delivered
and guaranteed."* Never: *"a $Nk return,"* *"double your money,"* or anything tying the number to the
advertiser's revenue.
