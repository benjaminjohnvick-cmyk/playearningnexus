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
