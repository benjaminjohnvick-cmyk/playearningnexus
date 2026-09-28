# Social Posting — One-Tap Composer, Consent & Compliance

_Version: Get Goods Gratis 38 · 2026-09-28. How members connect accounts, consent to social advertising, and post
AI-generated ads with the least friction the browser allows. **Not legal advice.**_

## 1. Connecting accounts (consent, not scanning)

There is **no** "scan all my social accounts" capability — that isn't technically possible and was
corrected in design. Members explicitly **OAuth-connect** each account they want to use, on the
`SocialMediaSetup.jsx` page (`socialMediaOAuthHandler`), creating a `SocialMediaConnection`. Enrollment in
the up-front PPC grant records `ppc_social_ads_opt_in` via clickwrap consent, with a plain-language
"what this means" explanation (`PremiumPPCEnrollButton.jsx`). Consent covers AI-generated, `#ad`-disclosed
posts for PPC advertisers **and** the platform's own daily business post.

## 2. Getting to "just hit Post" — what's actually possible

A website **cannot** type into another website's compose box. The browser's same-origin security stops
our page from reaching into twitter.com / instagram.com's DOM to fill a field — the same protection that
stops any site from puppeteering your logged-in accounts. So the ad queue routes to the closest
achievable experience per platform (`src/lib/socialCompose.js`):

- **Prefill** (open the platform's own composer with the text already in the box → member just hits
  Post): **X/Twitter, Reddit, Telegram, WhatsApp** via intent URLs.
- **Share sheet** (OS native `navigator.share` → member picks the app, caption rides along; best on
  mobile): **Instagram, TikTok, Facebook, LinkedIn**, where web text-prefill was deprecated.
- **Copy + open** (universal fallback): copy to clipboard, open the site, member pastes.

The member always taps Post/Share themselves — reliable and compliant. The text is also copied to the
clipboard as a safety net. `PremiumAdQueue.jsx`'s primary button label/icon adapts per platform
(`primaryActionLabel`), and the "I posted it" confirm is what credits the member and feeds the
ad-learning loop.

## 2a. The automatic scheduler is member-in-the-loop by default (enforced in code)

`automaticSocialPostingScheduler` — the function that generates and (formerly) published posts on a
schedule and on connect — now **drafts and queues** rather than publishing live. Every generated post is
saved as a `SocialMediaPost` with status **`pending_approval`** (source `auto_scheduler_draft`), which
surfaces in the member's `PremiumAdQueue` where they review, edit, and tap Post/Share themselves. This is
member-initiated sharing, which is what keeps the platform inside social-network automation terms and the
FTC endorsement rule (the endorsement reflects a post the member actually saw and chose to publish).

**Live, zero-touch API posting is a gated exception, not the default.** It happens only when **all three**
hold:

1. `SOCIAL_API_AUTOPOST_ENABLED` is **ON** — the master counsel gate (ships OFF; appears in the Setup
   Wizard's counsel-gated panel; turning it on requires `COUNSEL_APPROVED`), **and**
2. `PREMIUM_ADS_REQUIRE_APPROVAL` is **OFF** (the member-approval gate is disabled), **and**
3. the platform is on the `SOCIAL_API_AUTOPOST_APPROVED_PLATFORMS` allow-list — meaning that platform has
   granted **written** approval for automated posting on the member's behalf and counsel has signed off.

**LinkedIn** is deliberately **not** auto-posted via API. LinkedIn's Professional Community Policies
restrict automated / incentivized posting, so LinkedIn routes to the member composer / share path and must
**not** be added to the allow-list until LinkedIn Marketing Developer Platform approval is on file. The
`postToLinkedIn` UGC-Posts adapter stays in the codebase but only ever runs behind the three gates above.

## 3. Feature flags & kill switches

| Flag / setting | Default | Effect |
|---|---|---|
| `social_posting` (feature flag) | — | Master kill switch for all AI social posting. |
| `ai_paused` (feature flag) | off | Global AI stop — halts the auto-advertiser with all AI agents. |
| `SOCIAL_API_AUTOPOST_ENABLED` | **off** | **Master counsel gate** for automated live API posting on a member's behalf. OFF ⇒ the scheduler drafts + queues for one-tap member approval. Counsel-gated in the Setup Wizard. |
| `SOCIAL_API_AUTOPOST_APPROVED_PLATFORMS` | _(empty)_ | Comma-list of platforms cleared (written approval + counsel) for automated posting. Only meaningful when the master gate is on and approval is off. Never includes `linkedin` without MDP approval. |
| `PREMIUM_ADS_REQUIRE_APPROVAL` | true | Posts queue as `pending_approval` (member one-taps) vs. scheduled. |
| `PREMIUM_OWN_AD_ENABLED` | true | Whether the platform's own daily business post is queued. |
| `PREMIUM_ADS_MAX_POSTS_PER_RUN` | 200 | Per-run post cap. |
| `PREMIUM_ADS_USERS_PER_ADVERTISER` | 25 | Per-advertiser member cap per run. |
| `AD_DISCLOSURE_TAG` | `#ad` | Disclosure text. Now placed at the **front** of scheduler posts via `withAdDisclosureFront()`. |

## 4. Compliance posture (and what needs counsel)

- **Disclosure (clear & conspicuous):** every scheduler post now **leads** with `#ad · Sponsored`
  (`withAdDisclosureFront()`), so the reader — and the member reviewing the draft — sees it before the ad
  copy, strengthening the FTC endorsement position over a trailing tag.
- **Member control (enforced, not just documented):** the scheduler queues drafts as `pending_approval` by
  default; the member reviews, edits, and taps Post. Fully automated live posting is gated behind the
  master counsel switch + a per-platform allow-list, all OFF at ship.
- **LinkedIn:** routed to the member composer/share path; API auto-posting stays dark until LinkedIn
  Marketing Developer Platform approval is on file.
- **Flagged for counsel/platform review:** platform developer/automation terms for any programmatic
  posting; FTC disclosure adequacy; incentivized-endorsement rules (members are rewarded for sharing —
  reward the disclosed share, not engagement metrics); and a durable consent-revocation path that stops
  future queueing.

## 5. Code map

- `backend/functions/automaticSocialPostingScheduler/entry.ts` — generates posts; **drafts + queues for
  member approval by default**; live API posting only behind the three gates in §2a.
- `src/lib/socialCompose.js` — per-platform prefill/share/copy routing + intent URLs.
- `src/components/premium/PremiumAdQueue.jsx` — one-tap post/share/copy + confirm.
- `backend/functions/socialMediaOAuthHandler`, `SocialMediaSetup.jsx` — account connection.
- `backend/functions/counselFeatureGate/entry.ts` — surfaces `SOCIAL_API_AUTOPOST_ENABLED` in the Setup
  Wizard as a counsel-gated (legal) feature.
- `backend/sdk/disclosure.ts` — `withAdDisclosure()` (trailing) and `withAdDisclosureFront()` (leading).

<!-- last synced to remote: 2026-09-28 (Get Goods Gratis 38) -->
