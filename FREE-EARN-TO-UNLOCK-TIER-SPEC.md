# Free "Earn-to-Unlock" Advertiser Tier — Design Spec

**Status: SPEC for review (not yet built). Counsel-gated before launch.**
The compliant path to the same goal: open the platform to the mass market of users who can't pay $12,000/yr
upfront, let them reach advertiser status over time, and still have the platform generate ~$8,000 of value
per engaged user — **without anyone owing anything.**

---

## 1. The core reframe

> **PRICING UPDATE (2026):** The paid advertiser price is now **$12,000/yr (or $1,000/mo), paid upfront**.
> The FREE earn-to-unlock tier is unchanged in spirit: a member still **earns the ~$8,000 unlock over the
> 4-year term**, and the platform then recovers the remainder of the $12,000 package value via a
> **NON-RECOURSE revenue-share — 10% of the member's generated revenue until $12,000 is recovered, then 5%
> ongoing.** It is taken only from revenue that actually occurs; nothing is ever owed as a debt or charged.
> See ADVERTISER-PRICING-2026.md and the FREE_ADVERTISER_REVSHARE_* / *_PRICE_USD settings.

The $8,000 changes meaning depending on which side it sits on:

- **Paid Tier 1 (existing):** the user *pays* $12,000/yr (or $1,000/mo) upfront. It's a price.
- **Free Earn-to-Unlock (this spec):** the user *pays nothing and owes nothing.* The $8,000 becomes the
  platform's **lifetime-value (LTV) target** — the revenue you earn by monetizing that user's activity over
  their tenure. **You generate it; they never owe it.**

This is ordinary rewards-app economics (how Swagbucks/InboxDollars monetize a free member), not a fee and not
a loan. The user experiences a *free* product that *grants them more* the more they use it.

## 2. How the platform generates ~$8k per engaged user (revenue, never a charge)

Per-engaged-user value is **stacked from streams you already run** — none of it billed to the user:

1. **Survey spread** — the platform keeps its share of the third-party survey revenue the user generates.
   (Free users are on the *standard* share, NOT the Tier-1 100%-keep — that's what leaves a spread for the
   platform.)
2. **Between-survey interstitial impressions** — the user views ads (including paid Tier 1 advertisers'),
   generating ad revenue.
3. **Shopping / affiliate** — commissions on their opt-in purchases.
4. **Marketplace** — fees on their transactions.

**Modeling target:** an engaged user reaches ~$8,000 of cumulative platform-generated value over ~3–4 years.
This is an **internal LTV target only** — it is never shown to the user as a price, a goal, or a balance.

## 3. The unlock ladder — advertiser benefits GRANTED as they engage

Progress is measured by one neutral **activity metric** (admin-choosable): surveys completed, active days, or
cumulative platform-value-generated. As a user crosses thresholds, the platform **grants** advertiser
benefits as a **reward for activity** — recorded, never owed, never clawed back:

| Threshold | Default (surveys) | Impressions/yr | Grant (maps to the existing Tier 1 value stack) |
|---|---|---|---|
| **1 · Starter** | 30 | 5% of full | Small ad-impression credit + free AI ad creative for one product |
| **2 · Growing** | 120 | 25% of full | Larger impression allotment + monthly AI social posts + real-time analytics |
| **3 · Established** | 300 | 50% of full | Automatic A/B testing + featured placement + sentiment insights |
| **4 · Earned Advertiser** | 730 | 100% (full) | The **full advertiser package** — parity with a paid Tier 1 advertiser |

Thresholds and the metric are admin-tunable (`EARN_UNLOCK_METRIC`, `EARN_UNLOCK_THRESHOLD_1..4`). The
impression fraction ramps 5% → 25% → 50% → 100% of the paid Tier 1 yearly allotment, so level 4 is true parity.

### 3b. Referrals — the fastest, heaviest-weighted path (never required)

Progress is a **weighted score** (`EARN_UNLOCK_WEIGHTED`, on by default) combining three activities, with
**referrals weighted heaviest** so referring is the fastest way to unlock:

`score = surveys × 1  +  qualified_referrals × 25  +  active_days × 2`  *(all weights admin-tunable)*

So one qualified referral advances a member like ~25 surveys — reaching the full package (730 pts) in ~30
referrals versus ~730 surveys. Members are **encouraged to try for a daily referral goal** (`EARN_DAILY_
REFERRAL_GOAL`, default **3/day**), surfaced as a goal and returned by `earnedAdvertiserSync`.

**Required onboarding invite step (exposure, NOT recruitment).** `EARN_ONBOARDING_REQUIRE_INVITE_STEP` (on)
makes the contact-invite feature a **required onboarding step**: every earn-to-unlock member is shown and
prompted to try it and must **acknowledge** it (`onboarding_invite_step: pending → done`, acked via
`earnedAdvertiserSync { invite_step_ack: true }`). **Sending is optional** — they can skip sending — and the
**survey-only unlock path is always preserved**. So the requirement is "be shown/prompted the feature," never
"actually refer someone," which keeps it a rewards program, not a recruit-to-advance pyramid.

**Internal $-value realization (operator-only; the customer NEVER sees it).** Each qualified referral is worth
`REFERRAL_INTERNAL_VALUE_USD` (**$5**) to the business and is applied toward the **$8,000 internal LTV target**
(`TARGET_USER_LTV_USD`) — "$5 knocked off the $8k per successful referral." The platform's survey spread (its
share of the member's gross survey value) also counts. `earnedAdvertiserSync` computes and stores it on the
record (`internal_value_generated_usd` / `internal_value_remaining_usd` / `internal_referral_value_usd`), but
**deliberately does NOT return it in the user-facing response**. The operator reads it via the internal/admin
`earnedAdvertiserLedger` (per-member or aggregate). It is accounting of value *generated from* the member —
never a price, a balance, or anything the customer is shown.

**Compliance guardrails on the referral mechanic (deliberate):**
- **Never required.** Referrals only *add* to the score. A member can reach *every* level through their own
  surveys alone. Nothing is gated behind recruiting, so this stays a rewards program — not a
  recruit-to-advance pyramid (the regulated trigger this project already removed from the premium model).
- **The "3 a day" is a goal, not a gate.** No penalty for missing it; missing it costs nothing.
- **Only real, fraud-screened referrals count.** A referral counts only when the referred person actually
  joins and completes a first fraud-screened survey (`Referral.signup_bonus_paid = true`) — raw invites and
  spam blasts never count, which also keeps it clear of the mass-posting problem.
- **Counsel note:** because the unlocked benefit has value and referrals accelerate it, counsel should confirm
  the non-mandatory, real-referral-only design keeps it clear of pyramid/chain-referral rules.

A user who stays engaged eventually reaches the **same** value stack a paid Tier 1 advertiser gets — they just
*earned* it through participation instead of paying $8,000, while the platform earned comparable value from
their activity. Each unlock is a grant with a consent/record entry; there is no payment step and no debt.

## 4. Compliance guardrails (the entire point of the design)

- **Nothing is ever owed.** No balance, no deadline, no penalty, no shortfall charge, no collection. A user
  who stops owes nothing and keeps whatever they already unlocked (per policy).
- **Earned, not purchased.** Benefits are loyalty rewards the platform grants for activity — not a return on
  money (the user invests no money) and not a financed purchase.
- **No promised amount or timeline.** Never "$8/day," "$2,000/year," or "$8k in 4 years" anywhere. Copy is:
  *"Unlock more as you go — how far and how fast depends on your own activity and on availability, which vary
  and are not guaranteed."*
- **Not a security** (no investment of money; rewards flow from the user's own activity, not others' efforts).
- **Not consumer credit** (nothing advanced, financed, or owed — this is what keeps it clear of TILA/lending).
- **Closed-loop** — any credits are Site Cash / ad credits, on-site only, non-cashable.
- **The $8k LTV target is internal.** It lives in your models and admin, never in the user's face as a price.

## 5. Settings (admin-tunable, all built — category "Earned Advertiser")

- `FREE_ADVERTISER_TIER_ENABLED` (default on) — turn the free earn-to-unlock tier on/off.
- `EARN_UNLOCK_METRIC` (`surveys` | `active_days` | `value_generated`) — what activity counts toward unlocks.
- `EARN_UNLOCK_THRESHOLD_1..4` (30 / 120 / 300 / 730) — the metric level for each tier. Grants reuse the
  `TIER1_*` value-stack toggles; the impression fraction ramps 5% → 25% → 50% → 100%.
- `FREE_TIER_SURVEY_SHARE_PCT` (0.75) — the standard share a free/earned user keeps (leaves the platform its
  spread; NOT the Tier-1 100%-keep).
- `TARGET_USER_LTV_USD` (8000) — **internal modeling target only; never user-facing.**
- `TIER1_NOUPFRONT_ENABLED` (on) — offer the no-upfront advertiser option.
- `TIER1_NOUPFRONT_TERM_YEARS` (4) — the participation/delivery term (not a debt).
- `TIER1_NOUPFRONT_ACTIVE_WINDOW_DAYS` (30) — how recently active counts as "participating."
- `EARNED_ADVERTISER_INTERSTITIAL_ENABLED` (on) — serve earned/no-upfront advertisers' ads in the
  between-survey slot while they participate.
- `EARN_UNLOCK_WEIGHTED` (on) — use the weighted surveys + referrals + active-days score.
- `EARN_WEIGHT_SURVEY` (1) / `EARN_WEIGHT_REFERRAL` (**25, heaviest**) / `EARN_WEIGHT_ACTIVE_DAY` (2) — the
  unlock weights; referral weight is the heaviest so referrals are the fastest path.
- `EARN_DAILY_REFERRAL_GOAL` (3) — encouraged daily referral target (not required, no penalty).
- (No charge/owe settings exist for these tiers — the absence is structural and intentional; every record
  stores `owed: 0`.)

## 6. How it maps to code (BUILT)

- **Entity:** a dedicated `EarnedAdvertiser` record (separate from paid `FoundingAdvertiser`, so it never
  pollutes the paid-seat count / 100k cap). Fields: `mode` (free_earn | noupfront_tier1), `unlock_level`,
  `metric`, `activity_progress`, `perks_granted`, `survey_earn_share_pct`, `term_years`, `last_active_at`,
  `commitment_accepted`, and `owed: 0` (always).
- **SDK:** `backend/sdk/earned-advertiser.ts` — the ladder (`levelGrants`, `unlockLevelFor`, `unlockProgress`),
  `computeActivity` (from `DailyEarnings`), `noupfrontParticipating`, `activeEarnedAdOwners`, `earnedDisclosures`.
- **Functions:** `earnedAdvertiserJoin` (opt into free or no-upfront, records consent, nothing owed) and
  `earnedAdvertiserSync` (recompute activity, grant newly-unlocked levels, notify — idempotent, never charges).
- **Ad delivery:** `surveyInterstitialGate` now serves earned/no-upfront advertisers' active creatives (after
  founding + paid PPC priority, before house), so the free/unlocked advertising actually delivers while they
  participate.
- **Grants:** reuse `tier1Perks()` and the value-stack getters, so an earned advertiser at level 4 reaches
  parity with a paid Tier 1 advertiser.

## 7. No-upfront Tier 1 — advertiser status for $0, on a 4-year PARTICIPATION basis (not a debt)

A third on-ramp, for people who want **advertiser status from day one** without paying $12,000/yr:

- **$0 upfront. Nothing owed. Ever.** No balance, no charge, no penalty.
- The advertiser gets the **full package granted immediately**, but the **advertising is delivered over a
  participation term** (default **4 years**, `TIER1_NOUPFRONT_TERM_YEARS`). While they stay active (within
  `TIER1_NOUPFRONT_ACTIVE_WINDOW_DAYS`, default 30), their free ads keep delivering.
- **The "4-year condition" is a delivery schedule and a condition of the free benefit — NOT a binding
  obligation and NOT a debt.** If they stop participating, delivery of the *remaining, undelivered* free
  advertising simply pauses or ends. They are **never charged and never owe anything.**
- The platform generates its ~$8k value from the member's **activity over those years** (survey spread, ad
  views, commerce) — its LTV, exactly as in the free tier. This is why it's structured as participation, not
  payment: the value comes from engagement over time, so the free benefit is tied to that engagement.
- Free-tier survey share applies (standard, not the Tier-1 100%-keep), which is part of how the spread funds
  the platform.

> ⚠️ **Compliance line, deliberately drawn:** we do NOT implement "use the app 4 years or you owe $8,000."
> That would be consumer credit / a financed purchase with a debt — the exact trap avoided across this
> project. We implement "free advertising delivered over 4 years while you participate; stop and it stops;
> owe nothing." Same 4-year condition, zero liability on the member.

## 8. The three on-ramps, side by side

| | **Paid Tier 1** | **No-upfront Tier 1** | **Free Earn-to-Unlock** |
|---|---|---|---|
| Upfront cost | $12,000/yr ($1,000/mo, non-refundable) | $0 | $0 |
| Owes anything? | No | **No** | **No** |
| Condition | — | Participate over ~4 yrs (delivery term, not a debt) | — |
| Survey share | Keeps 100% in-window | Standard share | Standard share |
| Advertiser benefits | Full package now | Full package, delivered over the term | Unlocked progressively as they engage |
| Platform gets its value via | Upfront cash | Monetizing activity over the term (~$8k LTV) | Monetizing activity over time (~$8k LTV) |
| Best for | Believers with capital | Committed users who want in now, no cash | The mass market (budget-conscious users) |

All three funnel to the same place — an engaged advertiser-user — from different starting points. The paid
tier funds the launch with cash today; the no-upfront and free tiers grow the audience that makes the paid
tier worth buying, and monetize that audience over time. **No member ever owes anything in any tier.**

---
*Not legal advice. The "earn-to-unlock, nothing owed" structure is deliberately chosen over any "pay $8k over
time / owe a balance" structure to stay clear of consumer-credit, earnings-claim, and return-of-capital
issues. Counsel must review the mechanics and all user-facing copy before launch.*
