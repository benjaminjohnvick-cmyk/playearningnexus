# Buy Physical Items — store section (ship / local pickup)

A dedicated "Buy Physical Items" section in the marketplace with two ways to get an item, full
marketplace parity, serverless-GPU category tiles, and multiple payment options — including the legal,
non-lending versions of "buy now, work it off."

## The section

- A new **Physical Items** department in the taxonomy (`taxonomy.ts`) so `aiCategoryImages` generates a
  **serverless-GPU tile** for it (and for "Buy Online & Ship" / "Local Pickup") exactly like every other
  category.
- A `PhysicalStore` page (auto-routed; nav entry + a banner from the Marketplace) with a **two-option
  chooser**: (1) **Buy online & ship**, (2) **Buy locally & pick up**. Full parity: search, sort,
  localized pricing + country flag, listing grid.
- `fulfillment_mode` ("ship" | "pickup") + `pickup_location` on listings (`createMarketplaceListing`);
  the store filters by mode and pickup orders route to `local_pickup` fulfillment.

## Sort control + one-click Buy now

The results carry an Amazon-style **sort dropdown** at the top (Featured, Price ↑/↓, Avg. Customer Review,
Newest, Best Sellers) via the shared `src/lib/storeSort.js`, and a one-click **⚡ Buy now** button on each
card that logs the order immediately (no charge, no listing claim) and then prompts the buyer to complete
the purchase. See `STORE-SORT-AND-ONE-CLICK.md`. Teen buyers' orders route to their adult holder for
approval before anything is reserved or charged (see `HOUSEHOLD-TEEN-ACCOUNTS.md`).

## Payment options (credit card is the primary default)

1. **Credit card (default)** — real payment, +10% markup (`STORE_MARKUP`).
2. **Points / surveys only** — pay with earned closed-loop points.
3. **Affirm BNPL** — licensed third-party financing for real goods (off until merchant keys are set).
4. **Layaway** — reserve the item and pay it down with earned points BEFORE it ships.

Promotional (welcome) credit is applied automatically per the existing rules (platform-catalog items,
per-order cap, USD-denominated, expiry, breakage).

## Affordability warning

If an order total exceeds `PHYSICAL_AFFORDABILITY_LIMIT_USD` (default **$1,460** — the reasonable
annual-earnings figure), the buyer is warned before they commit that it's more than they can realistically
earn/pay back in a year, and offered lower-cost options, Affirm, or layaway. It's a **warning, not a hard
block** (they can proceed with acknowledgement).

## Purchase Payback — the "earn it back" tracker (NOT a loan)

The user pays with their **own credit card** — the platform lends nothing and gives no money upfront. The
Purchase Payback tracker then shows, as a motivational progress bar, how much they've **spent** (card/BNPL
orders) versus how much they've **earned back** in closed-loop points they can spend on-platform. It is a
**factual tracker of already-earned vs already-spent**, not a projection or a promise: the copy states
plainly that it isn't a loan and that how much you earn back depends on your own activity. No guaranteed
"cost to zero" claim (that would be an FTC earnings-claim problem). `purchase_payback` flag.

## Layaway — the legal "work it off" path (no credit extended)

Layaway means the buyer **receives nothing until it's fully paid** — so no credit is extended and it's not
lending. They reserve the item and pay it down with earned points; when fully paid it ships (or is ready
for pickup). The plan's **required monthly payment is capped at `LAYAWAY_MAX_MONTHLY_USD` (default $90)** —
the term is stretched so monthly ≤ that cap. Cancelling refunds paid points (closed-loop) and releases the
item. Functions: `layawayStart`, `layawayContribute`, `layawayStatus` (also cancels). Welcome credit is
computed at start to set the target and redeemed at completion.

## Why the "negative balance" is legal here

The original "negative balance you work off" was reframed after clarification: it is **not** the platform
fronting money (that would be consumer lending). The user pays with their own card; the "balance" is purely
the Purchase Payback **tracker** of value they can earn back through normal, closed-loop points. Combined
with Affirm (licensed BNPL) and layaway (pay-before-delivery), every "buy now / pay over time" need is met
without the platform extending credit.

## Flags & settings

Flags: `physical_store`, `local_pickup`, `layaway`, `purchase_payback` (all default on). Settings:
`PHYSICAL_AFFORDABILITY_LIMIT_USD` (1460), `LAYAWAY_MAX_MONTHLY_USD` (90), `PICKUP_RADIUS_NOTE`,
`STORE_MARKUP` (10%).

## Honest note

Keep payback/earn-back language factual and conditional ("earn points toward what you spent — depends on
your activity"), never a guaranteed payback. I'm not a lawyer; a quick framing review with counsel keeps
the earnings-claim wording clean.
