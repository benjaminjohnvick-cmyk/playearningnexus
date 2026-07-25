# Server-Side Economy — Balances Can No Longer Be Tampered With

**Problem (found in audit):** the entire credit economy was trusted to the browser. Rewards were *credited* and purchases *debited* client-side via `base44.auth.updateMe({ current_balance })`, and a user could even write their own balance directly through `/entities/User/update`. A technical user could open the console and set their balance to anything.

**Fix:** balance/economy fields are now **server-only**. The client cannot write them by any route; every change goes through a server function that uses the service-role SDK.

_Implemented July 23, 2026._

## The two locks (the actual fix)
1. **`/auth/updateMe`** now strips economy fields from any client patch (in addition to the existing `password_hash`/`role` strip). Blocked attempts are logged to `AppLog` (`event: blocked_client_balance_write`) so any missed call site surfaces instead of failing silently.
2. **`/entities/User/update` (and create/bulkCreate)** now strips the same economy fields for client requests. This was the bigger hole — RLS limited a user to their *own* record, but they could still inflate their own balance. Closed.

Protected fields: `current_balance`, `total_earnings`, `survey_balance`, `commission_balance`, `commission_earned`, `virtual_currency`, `points`, `available_balance`, `wallet_balance`, `lifetime_earnings`, `bnpl_credit_limit`, `bnpl_active`. (Backend functions use the service-role SDK and bypass the locks — that's the only way balances change now.)

## The sanctioned server paths
- **`awardReward`** — credits a reward. Idempotent per `claim_key` (no double-claims), capped per reason per UTC day, ledgered to `Transaction`. Only admins/developers can credit another user.
- **`spendBalance`** — debits with a server-side funds check + ledger; can grant an entitlement (e.g. a game) atomically.
- **`transferCredit`** — user-to-user store-credit transfer, both sides moved on the server.
- **`placeStoreOrder`** / **`purchaseStoreCredit`** — the store order + top-up paths (from the earlier increment).

## Client call sites migrated (no more browser balance math)
Credits → `awardReward`: `PPCSurveyTaker`, `OnboardingQuestWidget` (idempotent per quest), `DailyLoginStreak` (points, idempotent per day), `GoogleAdsOverlay`, `DisputeManager` (also fixes a bug — it was crediting the *admin* instead of the disputing user), `AutoDisputeWorkflow`.
Debits → `spendBalance`: `PPCAdSearchWidget` (search fee), `Withdrawal` (both handlers), `GameCheckoutModal` (store-credit game purchase).
Transfer → `transferCredit`: `MoneyTransfer`.

## Honest notes
- **Amount validation is the next layer.** `awardReward` currently trusts the amount the caller passes, but bounds abuse with idempotency + daily caps + audit. For full tamper-resistance, the amount should be derived server-side from the source entity per reward type (read the survey/quest and compute its reward). The plumbing is centralized so that can be added without touching call sites again.
- **Game entitlement (`game_library`) is not yet locked** — a user could still grant themselves a game via the client on the card/BNPL path. Lower priority than money; move game grants fully server-side as a follow-up.
- **Validation gate:** `deno check` and `npm run build` could NOT be run in the build sandbox (the npm registry and Deno download are firewalled — 403). I verified brace/paren/bracket balance, JSON validity, and logic on every changed file, but a real typecheck/build must be run on your machine before deploy — see the commands below.

## Run the real gate on your machine (do this before deploy)
```bash
# Backend typecheck (from repo root)
cd backend && deno check server/main.ts

# Frontend build (from repo root)
npm install
npm run build      # must complete with no errors; outputs ./dist
```
If either reports an error, send it to me and I'll fix it.
