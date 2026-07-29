# Store sort control + one-click "Buy now"

Two Amazon-style storefront additions shared by the Physical and Digital stores.

## Sort control (top of the results)

A standard sort dropdown sits at the top of the results in both stores, with the same set of options a
shopper expects from a large retailer:

- **Featured** (relevance — keeps the source order)
- **Price: Low to High**
- **Price: High to Low**
- **Avg. Customer Review**
- **Newest Arrivals**
- **Best Sellers**

Implementation is a single shared module, `src/lib/storeSort.js`, exporting `SORT_OPTIONS` and
`applySort(listings, sort)`. Both `PhysicalStore.jsx` and `DigitalStore.jsx` import it, so the control is
identical across stores. Sorting uses whatever listing fields are available with **graceful fallbacks**
(rating reads `rating ?? avg_rating ?? stars`; sales read `sold_count ?? purchases ?? sales ??
order_count`; newest reads `created_at ?? created_date`), so it works before ratings/sales data exists —
missing fields sort as 0 / stable rather than breaking.

## One-click "⚡ Buy now" (log immediately, then confirm to complete)

A prominent one-click button on every listing card, for buyers with a card on file. The flow is
deliberately two-step so intent is captured in one click **without** committing a charge:

1. **One click logs the order immediately** — an `Order` is created in `awaiting_payment` state,
   `payment_captured: false`. It is **not** a completed purchase, and it does **not** claim the listing
   (an unpaid one-click order never locks a one-of-a-kind item).
2. **A prompt then asks the buyer to complete the purchase** — "Order logged — complete your purchase?"
   Nothing is charged until they confirm, and a card is on file. If no card is on file, the prompt tells
   them to add one; the order stays saved until then.

Nothing is actually charged until the external payment processor path is live — `card_charging` remains
**OFF** until "processor + legal sign-off", so today the confirm step records intent and routes the buyer
to add/confirm a card rather than moving money.

### Backend — `oneClickPurchase`

`backend/functions/oneClickPurchase/entry.ts` (registered in `_manifest.json`). It validates the listing
(active, not affiliate, not the buyer's own, price > 0), computes the marked-up total with any
markup-funded welcome credit (capped so the charge never drops below base), applies the same
**affordability warning** as the rest of the store, and logs the order. It also honors the **teen/
household gate** (`purchaseGate`): a teen order that needs sign-off opens as `pending_approval` and
notifies the adult holder instead of `awaiting_payment`. The handler never touches raw card numbers.

### Frontend

`PhysicalStore.jsx` and `DigitalStore.jsx` each render the amber **⚡ Buy now** button, call
`oneClickPurchase`, reuse the existing affordability-warning modal, and show the "complete your purchase?"
confirmation modal on success.

## Flags & settings

Reuses existing controls: `STORE_MARKUP` (10%), `PHYSICAL_AFFORDABILITY_LIMIT_USD` ($1,460),
`PROMO_FUNDED_BY_MARKUP`, and the `card_charging` flag (OFF until processor + legal sign-off).
