# Social Posting — One-Tap Composer, Consent & Compliance

_Version: GamerGain 8 · 2026-07-29. How members connect accounts, consent to social advertising, and post
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

- **True zero-touch** ("we post it, member does nothing") only exists via the platform API path
  (`postAdToSocialMedia`, exposed as "Try auto-post"), which lights up **per platform once that platform's
  app-approval process is complete**.

## 3. Feature flags & kill switches

| Flag / setting | Default | Effect |
|---|---|---|
| `social_posting` (feature flag) | — | Master kill switch for all AI social posting. |
| `ai_paused` (feature flag) | off | Global AI stop — halts the auto-advertiser with all AI agents. |
| `PREMIUM_ADS_REQUIRE_APPROVAL` | true | Posts queue as `pending_approval` (member one-taps) vs. scheduled. |
| `PREMIUM_OWN_AD_ENABLED` | true | Whether the platform's own daily business post is queued. |
| `PREMIUM_ADS_MAX_POSTS_PER_RUN` | 200 | Per-run post cap. |
| `PREMIUM_ADS_USERS_PER_ADVERTISER` | 25 | Per-advertiser member cap per run. |
| `AD_DISCLOSURE_TAG` | `#ad` | Disclosure appended by `withAdDisclosure()`. |

## 4. Compliance posture (and what needs counsel)

- **Disclosure:** every post is `#ad · Sponsored` before it leaves (FTC endorsement rule).
- **Member control:** approval-by-default + copy/share paths mean the member always chooses to post.
- **Flagged for counsel/platform review:** platform developer/automation terms for any programmatic
  posting; FTC disclosure adequacy; and a durable consent-revocation path that stops future queueing.

## 5. Code map

- `src/lib/socialCompose.js` — per-platform prefill/share/copy routing + intent URLs.
- `src/components/premium/PremiumAdQueue.jsx` — one-tap post/share/copy + confirm.
- `backend/functions/socialMediaOAuthHandler`, `SocialMediaSetup.jsx` — account connection.
- `backend/sdk/disclosure.ts` — `withAdDisclosure()`.
