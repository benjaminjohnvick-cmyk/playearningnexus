# Admin Platform Settings — how it works & how to extend it

This adds a **Platform Settings** admin panel that makes prices, rates, thresholds, and toggles
adjustable **without a deploy**. It mirrors the existing compliance feature-flag pattern.

## What shipped (all 17 spec sections are in the panel)
- **`backend/sdk/settings.ts`** — the **registry** (every adjustable, ~75 keys across all 17 categories)
  plus the resolver. A value resolves **DB override → `.env` → built-in default** (30s cache).
  Typed getters: `getNumber(key)`, `getBool(key)`, `getString(key)`, `getList(key)`.
- **`backend/functions/adminSettingsCatalog`** (admin) — returns every setting with its current
  effective value + source (db/env/default), grouped by category.
- **`backend/functions/adminSettingsUpdate`** (admin) — validates against the registry, writes the
  override to the existing **`GlobalSettings`** entity, and records an **`AdminAuditLog`** row.
- **`src/pages/AdminSettings.jsx`** — the panel: grouped, typed inputs (number/text/toggle/select),
  per-section save, search, "unsaved" indicators, source badges, and a confirm on sensitive
  (money/legal) settings. Linked in the admin nav (`Layout.jsx`) and routed (`pages.config.js`).
- **No DB migration** — it reuses the `GlobalSettings` and `AdminAuditLog` entities you already have.

## What's wired LIVE right now (changing it in the panel takes effect immediately)
Two mechanisms make settings live:
- **Request-time async reads** — `await getNumber(key, fallback)` inside a handler.
- **Synchronous snapshot** — SDK config helpers call `snapNumber/snapString/snapList(key)`, which read
  a per-request snapshot. `backend/server/main.ts` calls `await primeSettings()` before every function
  runs, so the snapshot is fresh (30s-cached; an admin save invalidates it, so the next request reloads).

**Now live end-to-end:**
| Area | Settings | Wired in |
|---|---|---|
| Store markup | `STORE_MARKUP` | `placeStoreOrder`, `giftStoreItem` |
| Membership | `MEMBERSHIP_DAILY_FEE`, `MEMBERSHIP_AUTO_UPGRADE_AFTER_DAYS` | `membershipDailyFee` |
| Referrals / affiliate | `REFERRAL_MODEL`, `AFFILIATE_COMMISSION_MODE`, tier mins, ongoing rates, bounties, activation | `sdk/referral-model.ts`, `sdk/affiliate.ts` |
| Premium PPC | annual ceiling, doubling multiple, grid price, daily/boost caps, streak, welcome bonus, lapse, social credit, business rebate | `sdk/premium-ppc.ts`, `sdk/premium-boost.ts` |
| Catalog | `CATALOG_BLOCKED_CATEGORIES` (admin-extendable blocklist) | `sdk/catalog-policy.ts` |
| Compliance | `TERMS_VERSION`, `AD_DISCLOSURE_TAG`, `TAX_1099_THRESHOLD`, `TAX_BACKUP_WITHHOLDING_RATE` | `sdk/terms.ts`, `sdk/disclosure.ts`, `sdk/tax.ts` |
| AI & agents | `LLM_PROVIDER`, `LLM_MODEL_DEFAULT/LARGE`, `CLAUDE_MODEL_DEFAULT`, `IMAGE_PROVIDER`, `IMAGE_MODEL` | `sdk/integrations.ts` |
| Points | `POINT_VALUE_CENTS`, `POINTS_CASHABLE` | `sdk/membership.ts` |
| Messaging / legal | `EMAIL_FROM`, `BUSINESS_MAILING_ADDRESS`, `DMCA_AGENT_EMAIL` | `sdk/integrations.ts`, `sdk/aws/ses.ts`, `sdk/messaging-consent.ts`, `dmca*` |
| Games & contests | `TOURNAMENT_ENTRY_FEE` (fallback when a tournament sets none), `CONTEST_POWERUP_PRICE` | `enterTournament`, `buyContestPowerUp` |
| Payouts | `MIN_PAYOUT_USD` | `requestPayout` |
| Age gate | `MIN_AGE` | `server/auth-routes.ts` (signup) |
| Marketplace | `DEVELOPER_REVENUE_SHARE` | `calculateDeveloperPayout` |

Every remaining setting is **editable and saved in the panel today** and still honored via `.env`. The
ones NOT yet live are the **net-new knobs with no consumer yet** — Games (weekly jackpot pool,
tournament platform cut, auto-approve rating, rotation), Surveys (reward conversion, creation price,
fraud speeder), Gamification (XP/level, streak reward, leaderboard reset), plus `DAILY_EARN_CAP_USD`,
`AI_FULFILLMENT_MAX_ORDER_USD`, `REFUND_WINDOW_DAYS`, `GIFTING_ENABLED`, `SWEEPSTAKES_REG_THRESHOLD`,
`LLM_CONCURRENCY`/`AGENT_MAX_STEPS` (concurrency needs a restart), the frontend UI ones
(`SITE_NAME`/`PRIMARY_COLOR`/`GLOBAL_BANNER`/`MAINTENANCE_MODE`), and `CREATOR_PLATFORM_FEE`. Each
needs the value applied at its (sometimes net-new) logic point — the one-line swap below — which is a
deliberate feature edit, not a blind change.

> **Behavior-preserving note:** wiring `MIN_PAYOUT_USD`, `CONTEST_POWERUP_PRICE`, and
> `DEVELOPER_REVENUE_SHARE` also aligned their registry defaults to the values already live in code
> (`$5` min payout, `$0.50` power-up, `0.5` / 50-50 dev split), so nothing changes until an admin
> overrides them.

## The wiring pattern (one line per setting)
At the point a function uses a value, replace the constant/`Deno.env.get(...)` read with a settings
read that keeps the old value as the fallback:

```ts
import { getNumber } from "../../sdk/settings.ts";   // or getBool / getString / getList

// before:  const fee = MEMBERSHIP_DAILY_FEE;
const fee = await getNumber("MEMBERSHIP_DAILY_FEE", MEMBERSHIP_DAILY_FEE_ENV);
```

Rules: read it **at request time** (inside the handler), not at module top-level, so the DB override
is picked up. Pass the existing env constant as the fallback so behavior is identical until an admin
overrides it. That's the entire change per setting.

## Checklist — wire the rest (grouped by consumer)
Each row: the registry key(s) → the file to edit → the getter to use. All are the one-line swap above.

**Economy / points**
- `POINT_VALUE_CENTS`, `POINTS_CASHABLE` → `sdk/membership.ts` (`pointsToUsd`/`usdToPoints`) and any
  cash-out path → `getNumber` / `getBool` (make these helpers async, or read in the calling handler).
- `MIN_PAYOUT_USD`, `DAILY_EARN_CAP_USD` → `requestPayout`, `processWithdrawalRequest`, earnings writers.

**Premium PPC** → `premiumPPCEnroll`, `premiumPPCDailyReconcile`, `premiumPPCStatus`, `ppcNetworkCapacity`
- `PREMIUM_WELCOME_BONUS`, `PREMIUM_ANNUAL_POINTS_CEILING`, `PREMIUM_DAILY_EARN_CAP`,
  `PREMIUM_BOOST_CAP_WEEK1`, `PREMIUM_BOOST_CAP_MONTH1`, `PREMIUM_STREAK_BONUS_PER_WEEK`,
  `PREMIUM_STREAK_BONUS_CAP`, `PREMIUM_LAPSE_AFTER_DAYS`, `PREMIUM_SOCIAL_CREDIT_PER_DAY`,
  `PREMIUM_DOUBLING_MULTIPLE`, `PREMIUM_BUSINESS_REFUND_PER_DAY`, `PPC_GRID_ANNUAL_PRICE`
  (currently read from `sdk/premium-ppc.ts` / `sdk/premium-boost.ts` env constants).

**Referrals / affiliate** → `distributeMLMBonus`, `sdk/affiliate.ts`, `sdk/referral-model.ts`
- `REFERRAL_MODEL`, `AFFILIATE_COMMISSION_MODE`, `AFFILIATE_ACTIVATION_THRESHOLD`,
  `AFFILIATE_TIER_*_MIN`, `AFFILIATE_ONGOING_RATE_*`, `AFFILIATE_BOUNTY_*`.

**Store / catalog** → `sdk/catalog-policy.ts` (`CATALOG_BLOCKED_CATEGORIES` via `getList`),
`placeStoreOrder`/`aiOrderFulfillment` (`AI_FULFILLMENT_MAX_ORDER_USD`, `REFUND_WINDOW_DAYS`,
`GIFTING_ENABLED`).

**Games / contests** (mostly net-new reads — add `getNumber` where the price/threshold is applied)
- `TOURNAMENT_ENTRY_FEE`, `TOURNAMENT_PLATFORM_CUT` → `enterTournament`, `distributeTournamentPrizes`.
- `CONTEST_POWERUP_PRICE` → `buyContestPowerUp`.
- `WEEKLY_JACKPOT_POOL` → `processWeeklyJackpot`.
- `GAME_AUTO_APPROVE_MIN_RATING`, `FEATURED_GAME_ROTATION_HOURS` → `autoGameApprovalAI`, `autoFeaturedGameRotation`.

**Surveys** → survey reward/creation/fraud functions
- `SURVEY_REWARD_CONVERSION` → `awardReward`/`bitlabsPostback`; `SURVEY_CREATION_PRICE` → `chargeSurveyCreation`;
  `SURVEY_FRAUD_SPEEDER_SECONDS` → `checkSurveyFraud`.

**Gamification** → `XP_PER_LEVEL` (UserLevel logic), `STREAK_DAILY_REWARD` (streak engine),
`LEADERBOARD_RESET_DAYS` (`autoLeaderboard*`).

**AI & agents** → `sdk/integrations.ts` (InvokeLLM/GenerateImage) + agent runtime
- `LLM_PROVIDER`, `LLM_MODEL_DEFAULT`, `LLM_MODEL_LARGE`, `CLAUDE_MODEL_DEFAULT`, `AGENT_MODEL`,
  `AGENT_MAX_STEPS`, `LLM_CONCURRENCY`, `IMAGE_PROVIDER`, `IMAGE_MODEL`, `AI_DAILY_SPEND_CAP_USD`.

**Compliance & legal** (numeric/string; on/off switches stay in `complianceFlags`)
- `TERMS_VERSION` → `sdk/terms.ts` (`CURRENT_TERMS_VERSION`); `AD_DISCLOSURE_TAG` → `sdk/disclosure.ts`;
  `BUSINESS_MAILING_ADDRESS` → `sdk/messaging-consent.ts`; `DMCA_AGENT_EMAIL` → `dmca*`;
  `TAX_1099_THRESHOLD`, `TAX_BACKUP_WITHHOLDING_RATE` → `sdk/tax.ts`; `MIN_AGE`,
  `SWEEPSTAKES_REG_THRESHOLD` → `sdk/jurisdiction.ts` / `server/auth-routes.ts`.

**Messaging / content / marketplace** → `EMAIL_FROM`/`EMAIL_FREQUENCY_CAP_PER_WEEK` (email senders),
`SOCIAL_POST_CADENCE_HOURS` (social posters), `SITE_NAME`/`PRIMARY_COLOR`/`GLOBAL_BANNER`/
`MAINTENANCE_MODE` (frontend reads `GlobalSettings`), `DEVELOPER_REVENUE_SHARE`/`CREATOR_PLATFORM_FEE`
(`DeveloperPayout`/`CreatorPayout`).

## Notes
- **Compliance on/off kill-switches** (`card_charging`, `cash_out`, `p2p_transfers`, `sms_marketing`,
  `multi_level_referrals`, …) are **not** duplicated here — keep editing them in the existing
  **Compliance Flags** panel (`complianceFlags`), which already does DB-override-wins-over-env.
- **Sensitive settings** (shield icon: markup, points-cashable, referral model, terms version, tax,
  min age, maintenance mode) prompt a confirm and are tagged `sensitive` in the audit log. Keep
  card-charging / cash-out / points-cashable in their safe state until legal clears them.
- To add a new adjustable later: add one line to `REGISTRY` in `settings.ts` — it appears in the panel
  automatically; then do the one-line consumer swap when you want it live.
