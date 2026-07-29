# App-store reviewer notes — paste at submission (Apple & Google)

Pre-written so the developer pastes instead of drafting, and so the review passes on the **first** try —
a clean pass is the single biggest factor in hitting the launch floor (a rejection round adds hours).

## Demo login (put this in the review-notes field)

> Demo account for review (no signup needed): open the app, tap **"Reviewer / Demo Login"** on the
> sign-in screen (enabled via REVIEWER_DEMO). It logs you into a pre-loaded account with sample earnings,
> a sample survey, store items, and notifications so every screen has real content to review.
>
> If a typed login is required instead:
>   email: reviewer@gamergain.app   password: (set REVIEWER_DEMO_PASSWORD; provide the value here)

## What the app is (framing — merit, not gambling)

> GamerGain is a rewards platform. Users earn on-site credit by completing **surveys** and **skill/merit
> activities** (e.g. verified referrals, engagement), then spend that credit in an on-site store. Rewards
> are **merit-based, never chance-based** — there is no wager, no random prize draw, and no purchase is
> required to earn. "Contests" and the weekly reward are ranked by **verified performance**, not luck.
> The core economy is **closed-loop**: earnings are on-site store credit; cash payout is limited to
> vetted business partners and is OFF by default at launch. Users must be **18+**.

## Data / privacy answers (match the store data-safety forms)

- Account data (email) — used for authentication only.
- No selling of personal data. No third-party ad tracking / IDFA (submission marked `add_id_info_uses_idfa: false`).
- Privacy Policy + Terms are published at public URLs (fill these in on the listing).

## If Apple flags "in-app currency / real money"

> Earnings are **store credit within a closed loop**, not a cash-out wallet. Cash disbursement is disabled
> at launch (`cash_out` OFF) and, when enabled, applies only to business partners with tax onboarding —
> not to ordinary users. There is no gambling mechanic: no stake, no random-outcome prize.

## Checklist before you hit submit

- [ ] Demo login works from a fresh install (REVIEWER_DEMO=1 deployed)
- [ ] Privacy Policy + Terms URLs live and linked in the listing
- [ ] Screenshots generated (`deploy-kit/mobile/gen-screenshots.mjs`)
- [ ] Data-safety / privacy questionnaire matches the answers above
- [ ] 18+ age rating set
