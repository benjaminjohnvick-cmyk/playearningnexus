# Full Code Audit — 2026-07-29 (repo as source of truth)

A line-by-line audit of the codebase by five parallel reviewers (money/payouts, marketplace/store,
Premium PPC/ads, AI data-coverage, auth/compliance), plus a cross-cutting check that things asked for in
chunks are applied uniformly. This pass **fixed the highest-confidence money-safety, correctness, and
compliance issues** and **built the AI purchase-data capture** you asked about. Remaining items are listed
so nothing is lost. Not legal advice.

## Your headline question — "does the AI get data on marketplace purchases?"

**Before: no.** A purchase wrote only an operational `Order` row that the optimizer / self-learning loop
never reads. Purchases were invisible to the AI.

**Fixed:** new `backend/sdk/purchase-signal.ts` → `recordPurchaseSignal()` now writes, on every captured
purchase, a durable **`OptimizationSignal`** (kind `purchase`) **and** an **`InteractionEvent`**
(`event_type:"purchase"`) — the exact records the AI/self-learning layer already consumes
(`aggregateStats()` rolls purchase events into `catalog_purchase_rate`, which `buildSiteContext()` feeds
every AI decision). Wired into `purchaseMarketplaceListing` (captured points orders) and `placeStoreOrder`.
No new tables.

## FIXED this pass

**Money-safety (double-spend / double-credit):**
1. `placeStoreOrder` — balance debit is now ATOMIC (compare-and-set + retry) instead of a stale
   read-modify-write; two concurrent orders can no longer both pass the same balance check. (was HIGH)
2. `requestPayout` — payout reservation is now atomic (updateIf loop, re-checks available balance each
   attempt); closes the concurrent-request double-spend. (was CRITICAL)
3. `processPPCSession` — earnings, tier progress, and referral commission are now credited **once per
   (user, tier, day)**; replaying the same session no longer inflates balance, completes tiers early, or
   repeats referral payouts. (was HIGH)
4. `placeStoreOrder` — removed the advertiser "doubling" attribution here; it was **double-counting** every
   order (also credited at fund-release in `autoOrderFulfillmentAndFundsRelease`). Now credited once. (was HIGH)

**Premium PPC correctness:**
5. Up-front survey enforcement no longer silently disables after day one. `markSurveyDay` and the
   default/lockout check in `premiumPPCStatus` now accept `ceiling_reached` (not just `active`) for
   up-front members — previously the daily reconcile flipped them to `ceiling_reached` and all
   survey-commitment tracking + lockout stopped. (was HIGH — undermined the model's legal basis)
6. `markSurveyDay` make-up crediting fixed: uses `max(done_today, sessionsByMinutes)` not `done_today +
   sessionsByMinutes`, so cumulative daily minutes are no longer double-counted into extra make-up days. (was MED-HIGH)
7. `premiumPPCEnroll` — anti-double-grant: a user who already received the up-front $1,460 does NOT get it
   again on re-enrollment after a default (`alreadyGranted` guard). (was MED, latent)

**Compliance uniformity:**
8. `/auth/updateMe` now strips `jurisdiction`/`state` (server-only) — a client could previously PATCH these
   to defeat every jurisdiction gate (jackpots, prize thresholds, cash-out). (was MED-HIGH)
9. `awardSocialMediaJackpotEntries` now applies the 18+ + `featureAllowed('jackpots', juris)` gate, matching
   `awardReferralJackpotEntries` / `processWeeklyJackpot`. (was MED)
10. Affiliate ongoing-rate settings clamped to `0..1` in `settings.ts` (an admin could set 500%). (was LOW)
11. Registry gap fixed: `SurveySignal`, `DomainEvent`, `SurveyEvidence` added to `backend/db/entities.json`
    (they had tables but weren't registered, so migration tooling skipped them). (was LOW)

## REMAINING — prioritized for the next pass (documented, not yet fixed)

These are confirmed by the audit; they were held back from this batch to keep each fix verifiable. Ranked:

**Money-safety (high):**
- Payout rails (`paypalPayout`, `venmoPayout`, `cashappPayout`, `processRewardPayout`) have **no
  idempotency** — a retry/double-submit double-pays. Fix: claim the record with `updateIf(status pending→
  processing)` before sending, drop `Date.now()` from `sender_batch_id`, pass a Stripe `idempotencyKey`.
- `respondentMicroPayout` — no per-response idempotency (double-credit on retry). Claim
  `PPCSurveyResponse.payout_status unpaid→paid` atomically.
- `processWithdrawalRequest` — available-balance ignores pending/approved/processing withdrawals →
  over-withdrawal. Subtract in-flight withdrawals and reserve.
- `transferCredit` / `spendBalance` — non-atomic debits (double-spend) and no `gate()`; `transferCredit`
  has no rollback if the receiver-credit write fails.
- `autoPayoutRequestLifecycle` — reservation double-release (event-payload flag, not atomic); make it
  `updateIf(reservation_released false→true)`.
- `processMonthlyAffiliatePayouts` — pays real cash bypassing the `cash_out` kill-switch, closed-loop
  check, and `gate()`. Add all three (like `paypalPayout`).

**Compliance (medium):**
- `distributeTournamentPrizes` — pays prizes with no jurisdiction / registration hold (entry gates but
  payout doesn't). Mirror `processWeeklyJackpot`.
- FTC `#ad` disclosure missing on several auto-post paths: `aiContentGeneratorAndShare`, `postGamerGainAds`,
  `aiViralContentPublisher`, `mosaicAutoShareSocialMedia`, `automaticSocialPostingScheduler`. Wrap with
  `withAdDisclosure()`.
- Agent-runtime + TTS LLM calls bypass the global `AI_DAILY_SPEND_CAP_USD` and `ai_paused` (they call
  `api.openai.com`/`api.anthropic.com` directly). Route through the metered `InvokeLLM` accounting.
- Ledger coverage: `venmoPayout`, `cashappPayout`, `processRewardPayout`, `respondentMicroPayout` write no
  `MoneyLedgerEntry`, so 1099 totals under-report those rails. Add `postLedgerEntry` + reportable types.
- `MAINTENANCE_MODE` not enforced on `/agents/*` routes (checked after agent dispatch in `main.ts`).

**AI data-coverage (the "100% of features generate data" goal) — expand `collectSignals()`:**
The optimizer's `collectSignals()` reads a hardcoded entity list, so features not in it are invisible even
if they have data. Add reads (all reuse `OptimizationSignal`, no schema change): **Referrals** (+ emit
`referral.converted`), **Payouts** (+ emit `payout.executed/failed`), **Marketplace listing creation /
sell-through**, **Games** (engagement/ratings/votes), **Layaway**, **Points Boost** (`PointsBoostLedger`).
Also: `attributeOutcomes` maps 8 domain events but only ~1 is ever emitted — wire the missing
`emitEvent()` calls so agent-outcome grounding actually works. And `recordVariantMetric` accepts
client-supplied counts (gameable) — make purchase/objective metrics server-authoritative.

**Frontend correctness (medium):**
- `Marketplace.jsx` / `PhysicalStore.jsx` / `DigitalStore.jsx` show "Purchased!" for card orders that are
  only `awaiting_payment` and for teen orders that are `pending_approval`. Branch on
  `payment_captured` / `needs_approval`.

## Method note

Fixes were made against the working copy (repo = source of truth), each verified for brace/JSON balance.
This is a first high-priority fix pass; the Remaining list is real work for a follow-up, not a wishlist.
