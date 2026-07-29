# Points Boost — closed-loop "your points grow while you hold them"

The legal, $0-marginal version of "value goes up → capture the difference as more points." It is **not**
crypto, **not** an investment, and **not** a share of any pool — it's a loyalty mechanic where a user's
points visibly grow based on **their own** behavior, and the growth is credited as non-cashable,
closed-loop bonus points.

## How it works

Each user has a personal **Boost %** built from factors they control — daily streak, account tenure, and
whether they've **vaulted** (locked) points — capped at a hard ceiling (`BOOST_MAX_PCT`). Their balance
accrues bonus points at that rate. They (or a daily job) **harvest** the accrued growth into spendable
points, and a live dashboard ticker animates the number upward so it feels like an appreciating holding.

- **Boost engine** (`backend/sdk/points-boost.ts`): `boostStatus` (ticker data), `harvestBoost` (credit
  accrued growth), `setVault` (lock/unlock for a higher Boost).
- **Functions**: `pointsBoostStatus`, `pointsBoostHarvest`, `pointsBoostVault`, and
  `autoPointsBoostCredit` (scheduled daily "harvest" so points grow even without a click).
- **UI**: `PointsBoostCard.jsx` on the dashboard — live ticker, factor chips, Harvest + Vault buttons.

## Why it's closed-loop and free

- The bonus is **points** — the platform's closed-loop, non-cashable unit (cash-out stays OFF). Spendable
  only in the store/marketplace, never withdrawable. Harvested points are also tagged `boost_promo_points`
  so they can be explicitly excluded from any future cash-out.
- Cost is hard-bounded by **`BOOST_DAILY_CAP_USD`** and **`BOOST_LIFETIME_CAP_USD`** — the cost governors.
  Whatever the rates are, a user can't harvest more than these caps, so the realized cost is a small,
  capped discount against the platform's own margin, funded by breakage. **Marginal cash cost ≈ $0.**

## Why it stays a loyalty program (not a security)

Growth is keyed to the **user's own actions and holding**, framed as a reward — not to a common
enterprise's performance that holders profit from. That's the line that keeps it a loyalty mechanic
rather than an investment contract. Base earned points never decrease; only the bonus layer moves, and
only upward. No chance/randomness (so it's not gambling) — it's deterministic.

## Self-tuning (the AI process applies here too)

The **rate knobs** — `BOOST_BASE_RATE`, `BOOST_STREAK_RATE`, `BOOST_VAULT_BONUS_PCT` — are in the
optimizer's `OPTIMIZABLE` set, so the AI self-learning + live-experiment layer **auto-tunes and
A/B-tests them for engagement**, within their registry bounds, through the same segment-holdout →
significance → guardrail → promote pipeline as everything else. Harvests report a `boost_harvest` metric
so the experiments can measure impact.

Crucially, the **cost governors** (`BOOST_MAX_PCT`, `BOOST_DAILY_CAP_USD`, `BOOST_LIFETIME_CAP_USD`) are
on the `COMPLIANCE_DENYLIST` and marked sensitive — the AI can optimize the *feel* freely, but it can
**never** move the spend ceiling. So the feature optimizes itself while its cost stays pinned at ~$0.

## Controls

- Flag `points_boost` (default on). `BOOST_AUTO_CREDIT` (daily auto-harvest, default on).
- Rate knobs + caps in the "Points Boost" settings category.

## Honest note

Keep the marketing language on the **loyalty** side ("your points grow the more you use and hold") and
away from "interest / investment / guaranteed return." The mechanic is a bounded loyalty bonus — a quick
framing review with counsel keeps the wording clean. I'm not a lawyer; this is a framing check, not a
licensing project.
