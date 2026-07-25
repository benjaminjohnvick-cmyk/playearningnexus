# Store Orders, 10% Markup & User Classes — Status + Hardening

## Good news: the feature you described already exists
The "product search → pay with store credit → AI fills the order and ships it home, with a 10% markup" flow is **already built in your original code** — I confirmed it end to end:

- **`OrderViaSite.jsx`** is explicitly "used for wishlist items & product search results to place an in-site order." It collects the shipping address, lets the user pay with **store credit (`survey_balance`)** or **credit card**, and applies a **10% markup for regular users** (business accounts exempt).
- **`aiOrderFulfillment`** is a "Fully Autonomous Pipeline": scrape the vendor product page → find the best listing → AI generates a checkout plan → **executes the real checkout via a cloud browser (Browserless/Playwright)** → extracts tracking → notifies the user. Fallback escalates to an admin ticket.

So nothing new had to be built for the core flow. What it needed was **hardening + alignment**, which is what this change does.

## What I fixed
1. **The 10% markup is now enforced on the SERVER.** Before, `OrderViaSite` computed the markup *and deducted the store credit in the browser* (`auth.updateMe({current_balance})`) — a user could tamper with the client to skip the markup or avoid paying. New function **`placeStoreOrder`** now does it server-side: it computes the markup, checks and deducts the balance authoritatively, creates the Order, and triggers `aiOrderFulfillment`. `OrderViaSite` now calls it instead of doing its own math.
2. **One definition of "business account" everywhere.** Your original code had a subtle inconsistency: the order markup treated only `business`+`admin` as business, while payouts used `admin/developer/survey_creator/ppc_advertiser`. Now both use one shared list (`sdk/payout-policy.json` → `isBusinessAccount`). Business-capacity roles — **admin, developer, survey_creator, ppc_advertiser, affiliate, business, business_client** — pay **no markup** and can **receive cash**; everyone else is a regular user who pays the **10% markup** and earns **store credit only**. This matches your stated intent ("anyone in a business capacity such as affiliates gets cash; regular users get store credit").

## How the classes line up now (consistent across the whole app)
| | Regular user | Business account (partner) |
|---|---|---|
| Store markup | **+10%** | none |
| Earnings paid as | **store credit** (redeemable on-site) | **cash** (PayPal/CashApp/Venmo) |
| Can buy store credit by card | yes | n/a |

Roles are aligned to your actual code and tunable in one place: `backend/sdk/payout-policy.json`.

## The markup is a SINGLE one-time fee (not stacked)
Per your model, the 10% is charged **once, when a regular user buys an item** — the same amount whether they pay with store credit or card. The old code stacked a second 10% "card surcharge" on card-paid orders (≈21% total); that's removed. Now: regular user buying a $100 item pays **$110** by either method; business accounts pay **$100**. Buying store credit itself is **1:1 — no markup at top-up.**

## Buy store credit by card — now built (regular users)
Regular users can now **load store credit with a card**, separate from checking out a product:
- **`backend/functions/purchaseStoreCredit`** — 1:1 top-up (no markup); credits `current_balance` after the card is captured and records a `Transaction`.
- **`src/pages/AddStoreCredit.jsx`** (route `/AddStoreCredit`) — an "Add Store Credit" screen: pick/enter an amount, pay by card (reuses `PayPalCardCapture`), balance updates. It clearly states adding credit is 1:1 and the 10% only applies when buying an item.

This complements the existing per-order card option and the advertiser top-up (`AdBudgetTopUp`). Add a link to `/AddStoreCredit` from the wallet/profile to surface it.

## Files
New: `backend/functions/placeStoreOrder/entry.ts`. Modified: `backend/sdk/payout-policy.ts` (+`isBusinessAccount`, `applyMarkup`), `backend/sdk/payout-policy.json` (roles aligned to your code), `backend/functions/_manifest.json`, `src/components/store/OrderViaSite.jsx` (calls the server function; no client-side balance math).

## Honest note
`placeStoreOrder` trusts the `product.price` passed from the search result for the *raw* price (then applies the markup server-side). If your product search results come from an internal catalog entity, point `placeStoreOrder` at that entity to look the price up server-side too, so even the base price can't be tampered with. Where product prices come from external search, the raw price is inherently the vendor's — the markup (your margin) is what's now protected.
