# Sourcing & Fulfillment — AI shopping assistant + sanctioned channels

The user tells the AI what they want; the AI finds it, prices it, and autofills an order; the user approves
and completes **their own** purchase through a **sanctioned channel**. No scraping, no bot completing checkout
on a retailer, no stranger fulfilling another user's order, no cash moving to a workforce. That keeps it
legal, low-ops, and scalable, and it keeps the closed-loop / non-cashable-points shield intact.

## The one thing that decides everything: where the "buy" lands

- **Dropship (full AI automation).** For SKUs carried by a **connected supplier API** (your authorized
  account), the AI places the real order automatically. The buyer checks out **once on our store** (points
  opt-in + PayPal for the net); the supplier ships. We're the merchant of record. This is the "AI does the
  whole thing" corner — the more suppliers you connect, the more of the catalog is fully automated.
- **Affiliate hand-off.** For everything else, the buyer finishes on the **retailer's own site** (their
  payment, their session). The retailer is the merchant of record; you earn commission; you carry no
  fulfillment/return liability. Legal precisely *because* a human completes it.
- **Gift-card rail.** The buyer redeems non-cashable points for a real retailer gift card they spend
  themselves — store credit for a retailer, never cash to the user.
- **Buying desk (manual fallback).** The rare order with no sanctioned channel queues for a team member to
  place by hand, batch-approved. The exception, not the engine.

## What's wired

- **`aiOrderAssistant`** — discovery (authorized feeds + catalog) + AI autofill/recommend → a `SourcedOrder`
  draft. **`productSearch`** — direct feed search.
- **`assistedCheckout`** — the user approves an item; routes to dropship / affiliate / buying-desk, applies
  opt-in points, and (dropship) charges the net via PayPal.
- **`dropshipFulfill`** — places the supplier order on payment (falls back to the buying desk if a supplier
  isn't connected, so nothing is lost). Fires automatically on PayPal capture.
- **`redeemPointsForGiftCard`** / **`giftCardOptions`** / **`giftCardStockAdd`** — the gift-card rail
  (inventory + closed-loop redemption, spend-cap-aware).
- **`registerSupplier`** — connect a dropship/wholesale supplier (its API key lives in an env var, never the
  DB). **`buyingDeskQueue`** / **`buyingDeskBatchApprove`** — the manual fallback.
- SDK: `sourcing.ts` (router + merchant-of-record), `dropship.ts` (supplier API client), `product-feeds.ts`
  (discovery), `giftcards.ts` (inventory). UI: **AI Shopping Assistant** (user), **Buying Desk** (admin).

## Turning it on (the external accounts are on you)

The wiring is built; the accounts and keys are yours to connect — same pattern as PayPal, and nothing places
an order until they're set:

- **Product feeds:** set `PRODUCT_FEED_API_BASE` + `PRODUCT_FEED_API_KEY` (an affiliate aggregator or a
  retailer product API), and `AFFILIATE_TAG` for commission attribution.
- **Dropship supplier(s):** call `registerSupplier` with the supplier's `api_base` and the name of the env
  var holding its key (e.g. `SUPPLIER_ACME_KEY`), then set that env var. That flips those SKUs to full-auto.
- **Gift cards:** add inventory via `giftCardStockAdd` (bulk codes, often bought at a discount = margin).
- **Payments:** the buyer's card runs through PayPal (see PAYPAL-SETUP.md); the buyer pays directly wherever
  possible, which keeps money-transmission and chargeback risk off you.

## The honest limits

- "Anywhere" means "anywhere with a sanctioned door" — big retailer APIs, affiliate networks, dropship
  suppliers, and gift cards. In practice that's tens of millions of SKUs, so the buyer barely notices.
- On **dropship** orders you're the merchant of record → you own returns, chargebacks, sales-tax nexus, and
  product liability. Use wholesale/dropship pricing so the margin is real, and confirm tax handling with an
  accountant.
- Not legal advice — have counsel review the model before it's fully public.
