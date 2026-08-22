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
