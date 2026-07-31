# PayPal setup — card checkout + points-applied orders

All incoming and outgoing money routes through **your** PayPal business account. The app is fully wired to
create and capture payments and send payouts — it just needs your API keys. Until they're set (and the
`card_charging` flag is on), nothing charges: card orders sit as `awaiting_payment` and the app tells the
buyer card payments aren't enabled yet. **You** connect the keys and the money moves under your account — no
credential ever lives in the database, and nothing auto-authorizes a transfer without your PayPal approving
it.

## 1. Get your keys

In the PayPal Developer Dashboard → **Apps & Credentials**, create a REST app and copy its **Client ID** and
**Secret**. Use the **Sandbox** pair first to test, then switch to **Live**.

## 2. Set the environment variables

```
PAYPAL_CLIENT_ID=...           # from your REST app
PAYPAL_SECRET=...              # from your REST app
PAYPAL_ENV=sandbox             # sandbox while testing, then: live
PAYPAL_BUSINESS_EMAIL=you@business.com
PUBLIC_SITE_URL=https://yourdomain.com   # for the return/cancel redirects
```

Then turn on the `card_charging` compliance flag in the admin panel.

## 3. How it flows (already built)

- **Buy by card:** `hybridCheckout` (or the normal card path) creates a live PayPal order via
  `backend/sdk/paypal-api.ts → createOrder`, and returns an `approve_url`. The buyer is redirected there to
  pay.
- **Apply points (opt-in):** the buyer taps **Apply my points** at checkout (`pointsApplyPreview` shows how
  much applies — 12% of their balance non-premium / 24% premium). On confirm, their points are consumed as a
  **credit toward the purchase** (never cashed out to them), their dollar value is recorded as funded by your
  PayPal, and the card is charged only the remainder.
- **Capture + fulfill:** after approval, `paypalCaptureCheckout` captures the payment, marks the order paid,
  records the money-in, and fires AI order fulfillment.
- **Payouts:** `createPayout` pays suppliers/sellers (or funds the points-covered portion) from your PayPal
  balance.

## 4. Profit visibility

Every in/out is written to the `MoneyLedgerEntry` ledger. The admin **Profit** page shows money-in vs
money-out vs profit; the **Growth Engine** adds the reserve-aware "what's actually safe to withdraw" number
(after honoring outstanding points).

## Guardrails

- Points are **redeemed for goods**, never converted to cash paid back to the user — that keeps them
  non-cashable / closed-loop (the money-transmission shield).
- Live capture/payout runs under your connected PayPal credentials. The app computes and records; PayPal
  executes.
- Test end-to-end in **sandbox** before flipping `PAYPAL_ENV=live`.
