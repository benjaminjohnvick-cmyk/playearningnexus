# Premium PPC — Up-Front Grant & Social-Advertising Model

_Version: GamerGain 8 · 2026-07-29. Supersedes PREMIUM-PPC-CREDIT-ADVANCE.md, which described the earlier
earn-as-you-go/advance framing. This is the authoritative description of the Premium PPC network as it
now stands in code. **Not legal advice** — the flagged items require counsel sign-off before launch._

## 1. What it is, in one paragraph

A paying business buys a year of "PPC AdGrid" placement for a flat fee (default **$5,000**,
`PPC_GRID_ANNUAL_PRICE`). For every advertiser that pays, exactly one survey-member seat opens (a strict
**1:1 match** — N advertisers means at most N premium members). A matched member receives, **up front**,
the full annual value of **146,000 points = $1,460** in closed-loop, non-cashable store credit, in
exchange for committing to complete roughly **8 minutes of surveys per day for a year** (fulfillable
flexibly, with catch-up). The business, in return, receives **$10,000 in free perks and $10,000 of AI
social-advertising value**, and keeps getting advertised for free until it has **doubled its investment**
(received **$10,000 in fulfilled orders**). Everything is denominated in points that are spendable
through the site at any store — advertised in real dollars, delivered as points at **1¢/point**.

## 2. The member side — the up-front grant

- **Grant:** on enrollment, the member's balance is credited the full `PREMIUM_ANNUAL_POINTS_CEILING`
  ($1,460 in points). This is a toggle, `PREMIUM_UPFRONT_GRANT` (default **ON**); turning it OFF restores
  the older, safer earn-as-you-go path where the same ceiling is earned $4/active-day.
- **Not a loan, not a security.** Nothing is ever repaid or clawed back. There is no card charge, no
  "points owed," no debt, and no repayment schedule. The grant is not an investment of money by the
  member and pays no financial return, so it is structured to be neither consumer credit nor a security.
- **The only obligation is activity, and the only consequence of falling behind is a pause.** The member
  agrees to the survey commitment (`PREMIUM_SURVEY_COMMITMENT_DAYS` = 365, `PREMIUM_SURVEY_MINUTES_PER_DAY`
  = 8, with `PREMIUM_SURVEY_GRACE_DAYS` = 7 of slack). Completing a day's quota counts one survey-day
  toward the year (idempotent per UTC day; wired into `processPPCSession` and `premiumPPCSurveyDay`).
- **Missed days are made up, not lost.** Every missed day adds **one extra 8-minute session** to a later
  day. Each day the app recalculates how many days were missed and shows exactly how many sessions to
  complete today to catch up — e.g. after missing one day, today shows **2 sessions (16 min)**: today's
  plus one make-up. Completing the extra minutes in a day credits multiple survey-days at once (bounded by
  1 + missed days, and by the 365 total). The member has the **full commitment window (≥1 year)** from
  signup to make up any missed session; missing a day never creates a debt or expires the commitment
  inside the window. Backend: `makeupPlan()` + `markSurveyDay(userId, minutesToday)`; surfaced in
  `premiumPPCStatus.makeup` and `PremiumLockoutMode.jsx`.
- **Spent-out + behind = lockout, never a charge.** If a member spends (nearly) all their points
  (`PREMIUM_SPENT_OUT_PCT`, default 5%) **and** is behind pace beyond the grace window, PPC surveys are
  paused (`premiumPPCStatus` lazily flips the membership to `locked_out`). The member **keeps all their
  points**. They can rejoin when a new advertiser seat opens; re-enrollment then requires **lockout
  mode**.
- **Closed-loop, points-value-only.** Points are non-cashable and non-transferable; they are redeemable
  for goods through the site (which can reach any store's catalog). We advertise real dollar values with a
  clear disclaimer that the value is delivered as points worth 1¢ each, spendable at any store via the
  site. **Cash withdrawal is not part of this model** (a prior draft that mentioned cash-out was corrected
  — it would reverse the money-transmission posture).

## 3. Lockout mode (in-app)

Lockout mode is a member-set **daily in-app reminder** to complete the ~8-minute survey quota at a time
they choose. It is required as a condition of re-enrolling after a default, and available voluntarily to
anyone who wants help keeping pace. It is **in-app only** — a web/PWA/native app cannot lock the whole
phone, and we do not claim it does. Backend: `premiumPPCSetLockoutTime`; UI: `PremiumLockoutMode.jsx`
(reads `premiumPPCStatus`'s `lockout_mode_enabled` / `lockout_time`, shows how far behind pace the member
is, and — for defaulted/re-enrolled members — disallows turning it off).

## 4. The business side — perks, credit, and "doubling"

- **$10,000 in free perks + $10,000 in social-advertising credit** (`PREMIUM_BUSINESS_AD_CREDIT_USD`),
  advertised in dollars, delivered as value through the platform.
- **Free until doubled.** A paying advertiser keeps getting free AI social advertising until their
  fulfilled-order value reaches the **doubling target** (`PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD`,
  default $10,000 = 2× the $5,000 grid price). Order value is attributed automatically as orders are
  delivered and funds released (`creditAdvertiserOrder` in the fund-release loop of
  `autoOrderFulfillmentAndFundsRelease`). After doubling, free posting stops; any further earnings are
  points spendable on anything via the site.
- **Pay-for-performance.** Advertiser rewards are tied to activity actually delivered, so if members
  under-participate there is simply less to fund — nothing is clawed back from anyone.

## 5. Why this is structured to lower regulatory risk (and what still needs counsel)

The design deliberately removes the classic regulated triggers: **no money advanced or collected**
(consumer-credit/lending), **closed-loop non-cashable points** (money transmission / stored value), and
**no required recruitment** (pyramid/chain-referral — the referral engine is single-tier). This is a
**structural** risk-reduction, **not** a compliance sign-off.

**Flagged for counsel before launch:**
1. **The up-front grant.** Confirm that granting non-cashable points up front against an activity
   commitment (with no repayment and no clawback) is neither consumer credit nor a security in the launch
   jurisdictions.
2. **Advertising real dollar values.** Confirm the "$1,460 / $10,000" dollar framing with the
   points-at-1¢ disclaimer meets FTC substantiation and clear-and-conspicuous disclosure rules.
3. **Social advertising on members' accounts.** See AI-ADVERTISING-AND-LEARNING.md and
   SOCIAL-POSTING-ONE-TAP-AND-CONSENT.md — this needs platform-API terms review (Meta/TikTok/X/LinkedIn)
   and FTC #ad review.
4. **Tax.** The $1,460 grant may be reportable (1099) depending on characterization; confirm treatment.

## 6. Key settings

| Setting | Default | Meaning |
|---|---|---|
| `PPC_GRID_ANNUAL_PRICE` | 5000 | Advertiser's annual grid fee (USD). |
| `PREMIUM_UPFRONT_GRANT` | 1 (on) | Grant the full ceiling up front vs. earn-as-you-go. |
| `PREMIUM_ANNUAL_POINTS_CEILING` | 1460 | Member's yearly point value ($1,460 = 146,000 pts). |
| `PREMIUM_SURVEY_COMMITMENT_DAYS` | 365 | Length of the survey commitment. |
| `PREMIUM_SURVEY_MINUTES_PER_DAY` | 8 | Daily survey quota (minutes). |
| `PREMIUM_SURVEY_GRACE_DAYS` | 7 | Slack before "behind pace." |
| `PREMIUM_SPENT_OUT_PCT` | 0.05 | Balance fraction that counts as "spent out." |
| `PREMIUM_BUSINESS_AD_CREDIT_USD` | 10000 | Advertised free social-ad value to the business. |
| `PREMIUM_SOCIAL_POSTING_ORDER_TARGET_USD` | 10000 | Order value at which free posting stops (doubling). |

## 7. Code map

- `backend/sdk/premium-ppc.ts` — model config + helpers (`upfrontGrantEnabled`, `commitmentPace`,
  `isSpentOut`, `isDefaulted`, `markSurveyDay`, `creditAdvertiserOrder`, `usdToPoints`, doubling logic).
- `premiumPPCEnroll` / `PremiumPPCEnrollButton.jsx` — one-click clickwrap enrollment + explanation.
- `premiumPPCStatus` — pace, slot availability, lazy default-lockout.
- `premiumPPCSurveyDay` + `processPPCSession` hook — survey-day crediting.
- `premiumPPCSetLockoutTime` / `PremiumLockoutMode.jsx` — lockout mode.
- `premiumPPCOffer` — real-dollar offer surface with the points disclaimer.
- Scheduler: `daily-premium-ppc-reconcile` (08:00 UTC), `daily-premium-ppc-autoadvertise` (10:30 UTC).
