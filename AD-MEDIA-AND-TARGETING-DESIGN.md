# Ad Media, Cohort Targeting & Self-Learning Targeting — Design & Compliance Note

*Prepared for the owner and counsel. Describes the advertiser ad capabilities added this session: **audio/video
creatives** (interstitial + PPC network), **cohort targeting** from the mandatory Know-Your-Customer (KYC)
survey across every ad surface, a **self-learning AI targeting layer** matching the platform's AI posture, and
the **gap fixes** that make targeting consistent everywhere. **Not legal advice** — the privacy/advertising
questions flagged below are for counsel. Current as of 2026-09-07.*

---

## 1. What was added (summary)

1. **Audio & video ad creatives.** Advertisers may supply an **image, video, or audio** creative — for the
   full-screen **interstitial** placements *and* the **PPC ad grid**. In the PPC grid the video plays with the
   survey questions in a bar beneath it, and it **loops continuously through that advertiser's whole question
   set** until the shopper finishes.
2. **Cohort targeting from the KYC survey — on every ad surface.** Advertisers can target a specific cohort from
   the first-party welcome-survey answers. Targeting now applies to **(a) the in-app interstitial ads, (b) the
   PPC ad grid, (c) the social-media (endorser) distribution, and (d) the premium PPC auto-advertise engine.**
3. **A self-learning AI targeting layer.** An AI layer learns which creatives resonate with which cohorts and
   **orders matching ads by learned relevance** for each user, and **recommends** cohort refinements — under the
   platform's graduated-autonomy posture with a permanent gate and a kill switch.
4. **Gap fixes.** Targeting/personalization now flows through placements that previously missed it (the premium
   ad-free slot, the PPC grid, the auto-advertise engine).

---

## 2. Audio/video creatives

- A creative carries `media_type` (`image` | `video` | `audio`), `media_url`, and `poster_url` (still image;
  falls back to the thumbnail). Resolved **at serve-time**, so the admin enable-flags (`AD_MEDIA_VIDEO_ENABLED`,
  `AD_MEDIA_AUDIO_ENABLED`) apply retroactively — turning a format off makes existing creatives fall back to the
  image, nothing breaks.
- **Interstitial placements** (between-survey + in-app full-screen): the creative plays inside the ad slot with
  the mandatory **countdown unchanged**; a clip that ends early can unlock "Continue" early
  (`AD_MEDIA_UNLOCK_ON_END`). Video autoplays **muted with a tap-for-sound** control.
- **PPC ad grid:** the advertiser's **video plays above the survey questions**, which sit in a bar beneath it,
  and it **loops through the entire question set** for that advertiser until the shopper submits and the product
  page appears. Audio ads play over the thumbnail/poster the same way.
- **Rights & disclosure unchanged:** the advertiser attests content rights (DMCA); house branding still applies;
  the AI-generated disclosure label + C2PA provenance apply only to AI-generated creatives.

## 3. Cohort targeting — now on every surface

- **Source:** the mandatory KYC welcome survey (`kyc.ts`); answers live on `User.kyc_answers`. Targetable
  fields: product categories, goals, game genres, monthly budget, shopping style, shopping frequency, device.
- **Advertiser control:** pick any combination of cohort values and a **match mode** — *ANY* (broad) or *ALL*
  (narrow). No selection = **untargeted → everyone**.
- **Applies to:**
  - **In-app interstitial ads** — the selector filters candidates to matching creatives (house ad fills if none
    match).
  - **PPC ad grid** — the grid feed only shows a targeted PPC ad to users whose answers match.
  - **Social-media (endorser) distribution** — an advertiser's post is queued only to consenting, opted-in
    members whose answers match (still `#ad`-disclosed, still opt-in).
  - **Premium PPC auto-advertise** — the AI engine posts each advertiser's ad only to consenting members matching
    that advertiser's cohort.
- One matcher (`ad-targeting.ts`) governs all four, so behavior is identical everywhere.

## 4. Self-learning AI targeting layer

- **Posture (matches the platform's other AI):** graduated autonomy `suggest → assist → auto`
  (`AD_TARGETING_AI_AUTONOMY`, default **assist**), a **permanent gate**, and a **kill switch**
  (`AD_TARGETING_AI_KILL`). When off/killed, everything falls back to plain cohort matching.
- **What it does:** learns from observed engagement (a shopper answered a PPC creative and marked "interested",
  an interstitial completed) which creatives resonate with which cohorts, using **sample-smoothed** rates so a
  one-off fluke can't outrank a proven cohort. It then **orders matching ads by learned relevance** for the
  current user (a bias only — it never excludes an ad) and **recommends** cohort refinements to advertisers.
- **The permanent gate (important for counsel):** the AI may reorder relevance freely, but it **never changes an
  advertiser's contracted targeting, never targets an individual, and never introduces a new or sensitive
  attribute** — it only reweights the same non-sensitive, first-party KYC cohorts. Applying a recommended
  targeting change to an advertiser's campaign stays a human/assist action, never automatic.
- **Mechanics:** `adTargetingLearn` (admin/scheduled) rebuilds the model into an `AdTargetingModel` singleton;
  `adTargetingAiStatus` is an admin read of config + the learned model summary; the selectors consult the model
  to rank matching creatives.

## 5. Privacy & compliance posture (for counsel)

- **First-party, self-reported, non-identifying.** All targeting uses only cohort attributes the user provided in
  the survey. It targets a **group**, never an individual.
- **No sensitive/protected categories.** Current fields are commercial preferences (interests, budget band,
  style, frequency, device, game genres) — not protected classes. The survey is admin/AI-editable; **counsel
  should confirm no sensitive-category questions are added** without separate review.
- **Social distribution keeps its guardrails:** members remain **opt-in**, each post carries the **FTC `#ad`
  disclosure**, and reach counts only after the member confirms they posted.
- **The AI layer changes *relevance ordering*, not who is eligible or what an advertiser contracted** — so it
  does not expand data use beyond the cohort matching already disclosed.
- **For counsel to confirm:** (a) the Privacy Policy / consent disclose that **welcome-survey answers are used to
  select which ads a user sees and which ads a consenting member may post**, and the data-safety/nutrition-label
  forms match; (b) state **targeted-advertising opt-out** obligations (CPRA, CO/CT/VA, etc.) are met, with the
  existing `tracking_opt_out` honored; (c) using survey answers for advertiser targeting stays within the
  survey's stated personalization purpose; (d) no protected-class or sensitive targeting is offered; (e) the AI
  ranking layer's data use is covered by the same disclosures.

## 6. Admin settings (defaults)

| Setting | Default | Purpose |
|---|---|---|
| `AD_MEDIA_VIDEO_ENABLED` | ON | Allow advertiser video creatives (else fall back to image) |
| `AD_MEDIA_AUDIO_ENABLED` | ON | Allow advertiser audio creatives (else fall back to image) |
| `AD_MEDIA_AUTOPLAY` | ON | Autoplay media (video muted + tap-to-unmute) |
| `AD_MEDIA_UNLOCK_ON_END` | ON | Unlock "Continue" when an interstitial clip ends early |
| `AD_MEDIA_MAX_SECONDS` | 60 | Advertiser-facing clip-length guidance |
| `AD_TARGETING_ENABLED` | ON | Cohort targeting across all ad surfaces |
| `AD_TARGETING_AI_ENABLED` | ON | The self-learning relevance/recommendation layer |
| `AD_TARGETING_AI_AUTONOMY` | assist | AI autonomy cap: suggest / assist / auto |
| `AD_TARGETING_AI_KILL` | OFF | Emergency kill switch for the AI layer |
| `AD_TARGETING_AI_MIN_SAMPLE` | 30 | Min observations before the AI recommends a cohort |
| `AD_TARGETING_AI_PRIOR` / `_PRIOR_WEIGHT` | 0.1 / 20 | Smoothing prior + weight |
| `AD_TARGETING_LEARN_SAMPLE` | 5000 | Rows the learn pass samples per run |

## 7. Files touched (for the record)

- **New:** `backend/sdk/ad-media.ts`, `backend/sdk/ad-targeting.ts`, `backend/sdk/ad-targeting-ai.ts`,
  `backend/functions/adTargetingLearn/`, `backend/functions/adTargetingAiStatus/`,
  `src/components/ads/AdMedia.jsx`.
- **Changed:** `backend/sdk/interstitial-ad.ts` (targeting filter + media + AI ranking),
  `backend/functions/adGridFeed/entry.ts` (PPC targeting + media + AI ranking),
  `backend/functions/createAdGridAd/entry.ts` (store media + targeting),
  `backend/functions/socialAmplifyDistribute/entry.ts` (cohort filter),
  `backend/functions/premiumPPCAutoAdvertise/entry.ts` (cohort filter — gap fix),
  `backend/functions/premiumAdFree/entry.ts` (pass user for targeting — gap fix),
  `backend/sdk/settings.ts` (flags), `backend/db/schema.sql` (`AdTargetingModel`),
  `backend/functions/_manifest.json`, `src/pages/AdGridSurvey.jsx` (PPC video + questions-at-bottom),
  `src/components/ads/InAppInterstitialAd.jsx`, `src/components/surveys/SurveyInterstitialAd.jsx`,
  `src/components/advertiser/AdSignupForm.jsx` (advertiser format + targeting UI).

*Prepared for counsel. Not legal advice — the privacy and advertising-law questions above are the attorney's to
confirm.*
