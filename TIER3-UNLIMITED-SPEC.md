# Tier 3 Unlimited — Uncapped Scaling Above $200k

*An open-ended scaling tier above the $200,000 Tier 2 base: an advertiser names any budget they can afford and
the package scales proportionally, keeping the same conservative ~2× value ratio. Same compliance spine as Tier
1/Tier 2 — advertising value delivered, never a return. Not legal advice.*

## What it is

Tier 2 tops out as a fixed $200,000 "Scale" package. **Tier 3 Unlimited** removes the ceiling: an advertiser scaling
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

- **"As big as they can afford" = prepaid, upfront.** Tier 3 Unlimited is paid upfront (closed-loop spine) — it is
  **not credit, not a loan, not money transmission**. Affordability is enforced by payment, not by extending
  credit. (The money side reuses the existing Tier 2 deposit/prepay machinery, which stays counsel-gated.)
- **"As big as they want" = capacity-paced, never oversold.** However large the buy, the full allotment is
  **guaranteed as a total over the term and delivered as the audience grows** (the inventory governor's
  capacity-paced mode). We never promise a volume the audience can't eventually serve, and the **delivery
  guarantee** backs it: if we under-deliver the guaranteed volume, we make it up with free inventory (bounded).

## When a budget is bigger than current inventory — matched over time

If an advertiser's budget buys more impressions than the current audience can serve in a year, we don't turn
them away and we don't oversell. We **deliver the full purchased volume over time — matched to their number as
the audience grows** (`TIER3_UNLIMITED_MATCH_OVER_TIME`, default ON). Two properties make this safe:

- **Bounded by volume, not by time.** For a match-over-time plan the delivery make-good has **no expiry** — it
  keeps delivering until the exact purchased volume is served, however many years that takes, then closes. It
  can never deliver *more* than what was bought (still bounded by volume).
- **Honest outlook up front.** The quote returns a `delivery` object comparing the guaranteed volume to the
  current annual capacity: whether it `exceeds_current_inventory`, an `est_min_years_to_match` (an optimistic
  floor at today's audience, which shortens as DAU grows), and plain-language framing. The `/Apply` card shows
  this whenever the budget outpaces current inventory, so the advertiser sees "delivered over ~N years, matched
  to your number" before they buy — no surprise, no oversell.

Mechanically: `computeSeatGuarantees` and `deliveryMakeGoodSweep` read the plan's
`guaranteed_impressions_per_year`; when the plan is flagged `matched_over_time`, the make-good's `expires_at` is
left null and the sweep closes it only when the number is matched (never on the clock).

## Compliance framing (unchanged from Tier 1/Tier 2)

The scaled number is **advertising VALUE delivered** at conventional rates — never a claim about the
advertiser's revenue, sales, or ROI. There is no "return" language anywhere. Larger tickets get more scrutiny,
so the same substantiation and no-guarantee rules apply, only more so.

## Components

- `backend/sdk/tier3-unlimited.ts` — `tier3UnlimitedQuote(budgetUsd)` (scaled deliverables + ~2× value + guaranteed
  impressions + capacity-paced/prepaid), `tier3UnlimitedEnabled()`, `tier3UnlimitedMinUsd()`, `tier3UnlimitedMaxUsd()`.
- `backend/functions/tier3UnlimitedQuote/entry.ts` — the read/preview endpoint (budget → scaled quote).
- `backend/sdk/delivery-guarantee.ts` + `deliveryMakeGoodSweep` — now honor a per-plan
  `guaranteed_impressions_per_year`, so a Tier 3 Unlimited seat's custom guaranteed volume is backed by the make-good.
- `/Apply` — a Tier 3 Unlimited card with a budget input and a live scaled-value preview.
- Settings (Tier 2 Scaling): `TIER3_UNLIMITED_ENABLED`, `TIER3_UNLIMITED_MIN_USD` ($200k floor), `TIER3_UNLIMITED_MAX_USD`
  (0 = uncapped).

## Acceptance / billing

Quoting and surfacing are live (this spec). Charging a Tier 3 Unlimited package reuses the Tier 2 upfront-deposit
flow — the advertiser prepays, the plan is created with its `guaranteed_impressions_per_year` stamped (so the
delivery guarantee backs it), and delivery runs capacity-paced. Real money movement stays behind the same
processor + counsel gates as every other paid feature.

## Positioning language (safe)

Say: *"Scale as big as you want — your budget buys proportionally more advertising, at about 2× value, delivered
and guaranteed."* Never: *"a $Nk return,"* *"double your money,"* or anything tying the number to the
advertiser's revenue.
