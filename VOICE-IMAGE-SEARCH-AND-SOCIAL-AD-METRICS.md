# Voice & Image Product Search + Social Ad Metrics — Design & Compliance Brief

> **What's new (2026-09-19).** Three shipped capabilities on Get Goods Gratis (Free): (1) **voice** product
> search, (2) **image/photo** product search, and (3) the full advertising-metric set for the **social channel**,
> tracked for **every advertiser and the platform's own business ads**. All three work on the website and, through
> the Capacitor wrapper, on **iOS and Android**. This brief describes the mechanism and flags the (light) legal
> touchpoints. Not legal advice.

## 1. Voice product search

**What it does.** A shopper taps the mic in the store search bar and speaks a product name instead of typing it.

**How it works.** On-device first: browsers with the **Web Speech API** (`SpeechRecognition`) transcribe locally —
the audio never leaves the device. Browsers without it (notably the iOS app WebView) fall back to recording a short
clip and sending it to the server function **`voiceSearchTranscribe`**, which transcribes it (Whisper via the
existing `transcription.ts`) and returns text. Either way the transcript drives the normal product search. The mic
is used only after the user grants the browser/OS permission, and only while actively searching.

**Flag:** `VOICE_SEARCH_ENABLED` (on by default). **Engine:** `visual-voice-search`. **Function:** `voiceSearchTranscribe`.

## 2. Image / photo product search

**What it does.** A shopper uploads a photo (or takes one on mobile) and the platform finds that product.

**How it works.** The image is uploaded (existing `Core.UploadFile`), then a **vision model identifies** the
product (brand + model + key attributes) via **`imageProductSearch`**; the identified query drives a product-feed
search and returns results in the **same shape** as text search, each tagged with its sanctioned checkout channel.
Image capture is entirely user-initiated (a file picker / camera).

**Flag:** `IMAGE_SEARCH_ENABLED` (on by default). **Engine:** `visual-voice-search`. **Function:** `imageProductSearch`.

## 3. Social ad metrics — all advertisers + own company

**What it does.** The full network-standard advertising metric set — reach, impressions, clicks, CTR, conversions,
CVR, engagement, spend, revenue, **eCPM, CPM, CPP, windowed D1–D365 ROAS**, and delivered ad value — computed for
the **social channel** (member-amplified posts + the platform's own AI social ads), for **every advertiser** and
for the **platform's own business ads**.

**How it works.** The new **`social-ad-metrics`** engine reads the existing `SocialMediaPost` activity and computes
the metric set per advertiser, as a platform-wide aggregate + a per-advertiser leaderboard, and for the platform's
own ads (`post_type = "platform_own_ad"`). The **`socialAdMetrics`** function serves it: an advertiser sees their
own; an admin can query any advertiser, the platform's own ads, the total, or the leaderboard. Surfaced on the
advertiser (`AdBusinessDashboard`) and admin (`AdminDashboard`) dashboards via `SocialAdMetricsPanel`.

**Honesty posture (unchanged).** Every figure is **MEASURED** from real activity or clearly labeled with its basis;
below the data threshold ratios read "still gathering data," never a faked number; spend-based costs (CPM/CPP/ROAS)
appear only when a real social spend is recorded; impressions are estimated from reach only when a post has no
measured impression count (at the `SOCIAL_VIEW_RATE` estimate, labeled). **Delivered "ad value" = impressions × the
conventional CPM — never a guaranteed revenue/ROI result.**

**Flags:** `SOCIAL_AD_METRICS_ENABLED`, `SOCIAL_AD_METRICS_MIN_POSTS`, `SOCIAL_VIEW_RATE` (all on/measured by default).

## 4. Legal / compliance touchpoints for counsel

- **Microphone consent (voice).** Capture uses the browser/OS permission prompt; on-device transcription keeps audio
  local. The server fallback sends a short clip to a transcription provider — cover it in the privacy policy /
  sub-processor list (Whisper/OpenAI or self-hosted). This is speech-to-text for a search box, **not** voiceprint /
  biometric identification, so it is outside BIPA-style biometric-identifier scope — confirm and keep it that way
  (no speaker recognition). See `DATA-PROCESSING-AND-SUBPROCESSOR-BRIEF`, `BIOMETRIC-CONSENT-AND-DATA-POLICY-BRIEF`.
- **Camera / photo consent (image).** User-initiated upload/camera; the image is sent to a vision provider to
  identify the product — disclose the provider and the purpose; don't retain the image beyond the search unless
  disclosed.
- **App-store permission strings.** iOS `NSMicrophoneUsageDescription` / `NSCameraUsageDescription` /
  `NSPhotoLibraryUsageDescription`; Android `RECORD_AUDIO` / `CAMERA`. See `MOBILE-APP-WRAPPER-GUIDE.md`.
- **Advertising metrics.** The measured-not-guaranteed framing already reviewed for `ad-metrics.ts` applies
  unchanged to the social metric set — confirm the social eCPM/CPM/ROAS wording carries no implied ROI guarantee.
  See `FOR-YOUR-ATTORNEY` §10–11, `AD-MEDIA-AND-TARGETING-DESIGN`.

*Not legal advice. Reuses existing entities (no new data categories). Feature flags default on; the capture of mic/
camera is always user-permissioned.*
