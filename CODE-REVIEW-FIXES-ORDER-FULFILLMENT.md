# Code Review Fixes — AI Order Fulfillment & dead-URL sweep (round 2)

These fixes were applied after a second review focused on the automated AI order
fulfillment flow and "the same class of bug" as the surveyWidget dead-URL issue.

## Fixed
1. **Wrong email recipient (real bug).** `aiOrderFulfillment` sent the "Order Placed"
   confirmation to `order.user_id` (an ID) instead of the buyer's email. Every other
   function in the codebase uses `user.email`. Now it looks up the buyer and sends to
   `buyer.email` (skips gracefully if no email on file).
2. **Margin leak in sourcing budget (real bug).** The fulfillment agent budgeted the AI
   against `order.amount`, which for regular users already includes the 10% platform
   markup (amount = raw_price × 1.10). The AI could therefore spend the platform's margin
   on the item itself. It now sources against a new `sourcingBudget = order.raw_price`
   (falls back to amount for business/legacy orders where no markup applies).
3. **Dead base44.app URLs (surveyWidget class).** `sendSurveyNotifications` linked to
   `https://gamergain.base44.app/Surveys` and `notifyWeeklyTopEarners` to
   `https://gamergain.base44.app/Leaderboard` — both dead domains in user-facing emails.
   Replaced with `${APP_URL}` (env `APP_URL`, default `https://gamergain.app`).

## Verified fine (checked, not a bug)
- `src/lib/NavigationTracker.jsx` calls `base44.appLogs.logUserInApp` — the self-hosted
  client shim DOES define `appLogs`, so this is safe.
- Retry path: orders set back to `pending_ai_fulfillment` ARE re-picked up —
  `autoOrderLifecycleEngine` re-invokes `aiOrderFulfillment`.

## Still open (needs your decision — NOT yet changed)
- **Card payment not verified server-side.** In `placeStoreOrder`, the `credit_card`
  path trusts the client's `paypal_order_id` and creates the order without server-side
  capture/verification. A tampered client could create an order without real payment.
  Recommend verifying/capturing the PayPal order on the server before creating the Order.
