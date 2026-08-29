# Social Amplification — user-posted AI ads count toward delivered ad value (all tiers)

For **all three advertiser tiers**, the platform distributes the AI-generated social ads (from the Creative
Suite) to consenting members, who post them to their own social accounts. Each member's **follower reach**,
captured at signup, is counted as **estimated social impressions** that add to the advertiser's **delivered
advertising value** and to their **measured ROI/ROAS report**.

## How it works

1. **Capture reach at signup** (`captureSocialReach` → `captureUserSocialReach`). When a member signs up and
   connects social accounts, the platform sums their follower counts across active connections (plus any
   counts supplied on the signup form) and stores it as `social_reach` on the member — "the social media counts
   of users who sign up." Capped per member so one large account can't distort value.
2. **Distribute** (`socialAmplifyDistribute`). An advertiser's AI social ad is queued to opted-in members
   across their tier, `#ad`-disclosed, for one-tap posting — the same consent pipeline that already exists
   (`ppc_social_ads_opt_in`, `SocialMediaConnection`, member taps Post themselves).
3. **Confirm** (`socialAmplifyConfirm`). When a member confirms "I posted it," a `SocialAmplificationEvent`
   records their reach → **estimated impressions** (reach × a conservative view-rate) → **$ value** (at the
   same CPM the full-value guarantee uses), attributed to the advertiser and tier.
4. **Count toward value + ROI** (`advertiser-metrics.ts`, `advertiserSocialValue`). Those estimated impressions
   add to the advertiser's **delivered ad value** total and to a **social-inclusive ROI/ROAS** figure.

## What counts, and how it's valued

- **Reach → impressions.** We count `reach × view-rate` (default 30%), not raw follower count — organic social
  reach is well below follower count, so this keeps the counted value **substantiated**. Admin-tunable
  (`SOCIAL_AMP_VIEW_RATE`).
- **Impressions → dollars.** Estimated social impressions convert to advertising value at the **same CPM**
  (`FULL_VALUE_GUARANTEE_CPM_USD`, $22) the delivered-value guarantee uses, so social value adds consistently to
  "advertising value delivered."
- **Caps.** Reach per member is capped (`SOCIAL_AMP_MAX_REACH_PER_USER`, 50k) and members have a weekly
  posting-frequency cap (`SOCIAL_AMP_WEEKLY_POSTS_PER_USER`).

## Compliance (unchanged spine)

- Social impressions are **estimated** from reach and a view-rate, and **measured per confirmed post** — they
  flow into **advertising value delivered** and the **measured** ROI/ROAS report (actuals), **never a
  guaranteed ROI**. This matches exactly how `advertiser-metrics.ts` already treats ROI ("we measure actual
  ROI/ROAS; we never guarantee it").
- Only **opted-in** members, **`#ad`-disclosed** (`withAdDisclosure`), and the member always **taps Post
  themselves** — the existing one-tap consent flow. No auto-posting to anyone's account.
- The base on-platform metrics (impressions/revenue/ROAS that feed the pay-from-results rev-share) are left
  **unchanged**; social value is added as **separate additive fields** (`social_impressions`, `social_reach`,
  `total_impressions_incl_social`, `delivered_value_usd`, `revenue_incl_social_usd`, `roas_incl_social`).

## What's coded

- **`backend/sdk/social-amplification.ts`** — pure, unit-tested core (`userSocialReach`,
  `estimatedSocialImpressions`, `socialPostContribution`, per-tier gating, caps) + DB bridge
  (`captureUserSocialReach`, `recordSocialAmplification`, `socialImpressionsForAdvertiser`). 5 tests.
- **`advertiser-metrics.ts`** — adds the social-amplification impressions/value as additive fields to every
  advertiser's metrics.
- **Functions** — `captureSocialReach`, `socialAmplifyDistribute`, `socialAmplifyConfirm`,
  `advertiserSocialValue` (registered in `_manifest.json`).
- **Settings** — `SOCIAL_AMP_*` (enable, per-tier toggles, view-rate, reach cap, weekly cap).
- **Schema** — `SocialAmplificationEvent` table.

---

## Paid-endorser program + AI social-post engine — BUILT, gated OFF pending counsel

On top of the advertiser-value side above, opted-in members can be **paid endorsers**: they earn **Site Cash =
a share of the MEASURED conversion value** their disclosed posts drive. **OFF by default**
(`ENDORSER_ENABLED=0`); the record hooks credit nothing and the sweep is preview-only until enabled.

**Reward math.** Share = `ENDORSER_REWARD_SHARE_PCT` (default **0.20** = 20% of measured conversion value);
minimum conversion `ENDORSER_MIN_CONVERSION_USD` (default **$1**, noise floor); per-member caps
`ENDORSER_DAILY_CAP_USD` (default **$25/day**) and `ENDORSER_PERIOD_CAP_USD` (default **$500 / 4 weeks**).
Self-conversions earn nothing; **undisclosed posts earn nothing**. 1099: `ENDORSER_REWARD_1099_REPORTABLE`
(default **1**, reportable — confirm for closed-loop Site Cash). Code: `sdk/endorser-rewards.ts`,
`endorserConversionRecord` → `endorserRewardSweep`.

**AI social-post engine.** `endorserPersonalizePost` turns an advertiser's **approved** creative into
member/platform-native copy — **pinned to approved claims, no income claims**, with the **`#ad` disclosure
enforced and unremovable** (`enforceDisclosure`). It routes through the autonomy **`social`** domain: a
human-approved **DRAFT by default**; **auto-posting** fires only when `ENDORSER_PERSONALIZE_ENABLED` **and**
`ENDORSER_AUTOPOST_ENABLED` are on, the domain has **earned trust** (approved runs + agreement + data), **and**
the global kill switch is off. Eligibility (`endorserEligibleToPost`) requires consent + a live connection;
`ENDORSER_OPT_IN_REQUIRED` (default **1**) keeps that mandatory. Code: `sdk/social-endorser-engine.ts`.

**Self-learning (like the other ads).** Each generated post is tagged on creative axes (hook, tone, length,
CTA style, emoji, urgency, audience). Each disclosed, non-self conversion feeds those tags back into the shared
creative-suite **playbook**, per platform, as a positive signal scaled by value (capped) via
`recordCreativeOutcome`; future posts are conditioned on what's actually converting (`endorserPostConversionHook`
closes the loop). No schema change — reuses `OptimizationSignal`. Compliance posture is unchanged: it only tunes
**which approved framing** is used.

- **Endorser settings** — `ENDORSER_ENABLED` (0), `ENDORSER_REWARD_SHARE_PCT` (0.2),
  `ENDORSER_MIN_CONVERSION_USD` (1), `ENDORSER_DAILY_CAP_USD` (25), `ENDORSER_PERIOD_CAP_USD` (500),
  `ENDORSER_REWARD_1099_REPORTABLE` (1), `ENDORSER_PERSONALIZE_ENABLED` (0), `ENDORSER_AUTOPOST_ENABLED` (0),
  `ENDORSER_OPT_IN_REQUIRED` (1).
- **Endorser functions** — `endorserPersonalizePost`, `endorserPostConversionHook`, `endorserConversionRecord`,
  `endorserRewardSweep` (registered in `_manifest.json`).
- **Endorser schema** — `EndorserConversion` table.
- **Full counsel questions** — `SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md`.
