# Referral Program — affiliate model (single-level, activity-based)

A referrer earns two ways, both **in non-cashable points**, both **platform-funded** (the referred user is
never shortchanged), and both **single-level** (you earn only from people you directly referred):

1. **Activation bonus — 300 points, once per referral.** Paid to the referrer when their referred user
   completes a **first, fraud-screened survey** (real advertiser-funded activity — not just signing up).
   Idempotent: an atomic claim on the `Referral` row pays it exactly once even under concurrent surveys.
2. **Ongoing override — 10% of the referral's survey points.** Whenever a direct referral earns survey
   points, the referrer is minted 10% on top. It flows for **as long as the referral stays active**, because
   it's triggered by the referral's own activity. The referred user keeps 100% of their own points.

## Why this stays clear of pyramid/MLM law

- **Rewards follow real activity, not head-count.** The bonus only pays after the referred user does actual
  advertiser-funded work; there is no pay for merely recruiting someone. Primary earning on the platform is
  surveys — referrals are a bonus on top.
- **Single-level only.** `referral-rewards.ts` credits the direct referrer and never cascades; multi-level
  stays off unless deliberately opted in (`REFERRAL_MODEL=mlm` **and** the `multi_level_referrals` flag —
  see `referral-model.ts`).
- **Platform-funded / minted on top.** The override and bonus are recorded as **subsidies**
  (`referral_bonus`, `referral_override`, funded by `advertiser_pool+breakage`) — a cost the growth engine
  accounts for and reserves against — not value skimmed from the referred user.
- **Non-cashable.** Points never convert to cash. Earnings copy must say so, and avoid any "get rich"
  implication (FTC earnings-claims rules).

## Where it's wired

`backend/sdk/referral-rewards.ts` — `payReferralSignupBonusOnce()` + `creditReferralOverrideOnEarn()`.
Both are called after the point credit in the two survey earn paths: `bitlabsPostback` (third-party) and
`respondentMicroPayout` (own PPC surveys). Both calls are best-effort and never block the user's own credit.

## Knobs (Settings → Referrals)

`REFERRAL_SIGNUP_BONUS_USD` (4), `REFERRAL_OVERRIDE_PCT` (0.10), `REFERRAL_OVERRIDE_ENABLED` (on),
`REFERRAL_BONUS_REQUIRE_KYC` (off — turn on once identity KYC populates a user field; the first-survey +
fraud screen already gates the bonus).

## Notes

- **Fraud gating:** the bonus rides on a completed, fraud-screened survey; self-referral is rejected
  (`referrer == referred`). Turn on `REFERRAL_BONUS_REQUIRE_KYC` for an extra identity gate once available.
- **Funding/solvency:** the override adds ~10% to points issued to referred users; per-user advertiser
  revenue comfortably exceeds a user's own points + the override, and the growth engine reserves for the
  added liability. Confirm the structure with a fintech/FTC attorney before it's user-facing.

---

## Two-tier referral bonus (Site Cash) — BUILT, gated OFF pending counsel

A second, separate referral reward layer pays in **Site Cash** (non-cashable closed-loop store credit) and is
**single-tier** (referrer → referred; no downline). It is **OFF by default** (`REFERRAL_TIERS_ENABLED=0`) and
moves no Site Cash until enabled after counsel sign-off. Two bonus kinds:

1. **Referred USER bonus — $5 Site Cash** (`REFERRAL_USER_BONUS_SITECASH`, default 5). Staged automatically
   when a referred user becomes **active** (the real referral conversion, in `autoReferralConversionHandler` —
   gated + idempotent). Self-referral and already-paid are rejected.
2. **Referred ADVERTISER bonus — $2,000 Site Cash, for EACH of the three advertiser tiers.** The base is
   `REFERRAL_ADVERTISER_BONUS_SITECASH` (default **2000**), applied to **every** tier unless a per-tier
   override is set:
     - `REFERRAL_ADV_BONUS_TIER1` (default **2000**)
     - `REFERRAL_ADV_BONUS_TIER2` (default **2000**)
     - `REFERRAL_ADV_BONUS_TIER3` (default **2000**)
   So referring a paying advertiser on Tier 1, Tier 2, or Tier 3 each pays **$2,000 Site Cash** out of the box,
   and any tier can be tuned independently. The advertiser bonus pays **only after** the referred advertiser's
   payment **clears** AND a **clawback window** elapses (`REFERRAL_ADVERTISER_CLAWBACK_DAYS`, default **45
   days**), and **never** if refunded, charged-back, self-referred, or un-KYC'd — so every $2,000 is funded by
   a real, retained advertiser purchase and can't be farmed by fake sign-ups.

**1099:** both bonuses default to **reportable** (`REFERRAL_BONUS_1099_REPORTABLE=1`, conservative) — they flow
into the existing 1099 pipeline via a `MoneyLedgerEntry`. Confirm with counsel whether non-cashable closed-loop
Site Cash is reportable in your structure.

**Where it's wired.** `sdk/referral-tiers.ts` (amounts + eligibility, unit-tested) → `referralBonusRecord`
(stages a PENDING `ReferralBonus`, credits nothing) → `referralBonusSweep` (the gated payout: credits Site Cash
via `adjustUserBalance` + a 1099-reportable ledger entry, idempotent, preview-only while disabled). The user
bonus is also auto-staged from `autoReferralConversionHandler` on a real conversion.

**Anti-pyramid.** Still single-tier — no recruitment chain; the big bonus is tied to a real **paying advertiser**
(a finder's fee), not head-count. Platform stays in single-tier `affiliate` mode. See
`SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md` for the full counsel questions.

## Knobs (Settings → Referrals / Affiliate) — two-tier bonus

`REFERRAL_TIERS_ENABLED` (0 — OFF pending counsel), `REFERRAL_USER_BONUS_SITECASH` (5),
`REFERRAL_ADVERTISER_BONUS_SITECASH` (2000), `REFERRAL_ADV_BONUS_TIER1` (2000), `REFERRAL_ADV_BONUS_TIER2`
(2000), `REFERRAL_ADV_BONUS_TIER3` (2000), `REFERRAL_ADVERTISER_CLAWBACK_DAYS` (45),
`REFERRAL_BONUS_1099_REPORTABLE` (1).
