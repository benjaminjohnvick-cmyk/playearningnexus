# Livestream × Advertising — Counsel Brief

*Questions for our attorney on the live-hosting features built as part of the advertising ecosystem. This is an addendum to `HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF.md`; that brief covers the base hosting/streaming posture, and this one covers what was added on top: advertised-only streaming, in-stream ad breaks, QVC-scale broadcast, and pushing live sessions to members' social feeds. Everything below is **built but gated OFF** — `SESSION_HOSTING_ENABLED` (and the related flags) stay off until counsel clears them. Nothing is live; we are seeking sign-off before enabling.*

**Status:** All features are code-complete behind counsel gates. None can run until an admin turns the relevant flag on, which the product intentionally requires a "COUNSEL_APPROVED" acknowledgment to do. We are not asking whether we *may* build these — they exist in a disabled state — but whether, and under what conditions, we may **enable** them.

---

## 1. Advertised-products-only livestreaming

**What it does.** A host can only feature or sell a product in a live session if that product has an active advertising campaign in our system (an `AdGridAd` creative). Non-advertised products are refused. The streamed product is tagged with its advertiser for attribution. Gate: `HOSTING_ADVERTISED_PRODUCTS_ONLY` (on by default).

**Questions for counsel:**
- Does restricting live commerce to *advertised* products create any tying, exclusivity, or unfair-competition exposure we should be aware of?
- The advertiser whose product is streamed is identified internally for attribution — are there disclosure obligations (to the advertiser, or to viewers) that flow from that linkage?
- If a host is also the advertiser (self-promotion), does anything change in how the session must be disclosed?

## 2. In-stream audio/video ad breaks

**What it does.** Between product segments, viewers see a short (default 15s) audio/video ad drawn from our existing ad inventory (the same interstitial pool used elsewhere), targeted to each viewer, with an FTC-style disclosure already applied to creatives. The impression is recorded as ad revenue.

**Questions for counsel:**
- Our interstitials elsewhere are already reviewed; does inserting them **into a live video stream** change anything (e.g., ad-loading disclosure, "your content will be interrupted by ads" notice, or any streaming-specific ad rules)?
- Are there constraints on serving ads to viewers who may be minors in a live context, beyond our existing age-gating?
- The ad break is targeted using the viewer's KYC cohort answers — does live targeting raise any incremental privacy/consent obligation vs. our existing targeted interstitials?

## 3. QVC-scale broadcast (public HLS video at scale)

**What it does.** When an audience grows past the interactive limit, passive viewers are served an HLS video stream over a CDN, so one feed can reach a very large audience (potentially tens of thousands to millions concurrent). The host still screen-shares/presents; the crowd watches a one-way broadcast.

**Questions for counsel — this is the highest-exposure area:**
- **Moderation & DMCA:** at broadcast scale we are a public video platform. What moderation standard, notice-and-takedown process, and **registered DMCA agent** must be in place before we enable public broadcast? Does the existing plan in the parent brief suffice at this scale?
- **Recording/retention:** broadcasts can be recorded to VOD (separate gated flag). What consent (host and any on-screen parties), retention, and takedown rules apply to stored recordings?
- **18+ / content policy:** the host accepts a content policy before going live. Is that sufficient, and what must the policy prohibit (illegal, infringing, adult, harassing content) to limit our liability as the platform?
- **Accessibility:** does live/broadcast video trigger captioning or accessibility obligations for us?
- **State/'"live commerce"' rules:** does operating what is effectively a live TV-shopping channel implicate any broadcasting, telemarketing, or live-selling regulations?

## 4. Pushing live sessions to members' social feeds

**What it does.** Reusing our existing user-amplified social system, a live session can be announced to consenting members' connected social accounts (opted-in only, `#ad`-disclosed, one-tap post) with a "watch & shop" link. The members' estimated reach counts toward the advertiser's delivered value. Gate: `HOSTING_SOCIAL_SIMULCAST_ENABLED`.

**Questions for counsel:**
- Our existing social-amplification program is already reviewed; does using it to promote a **live commerce session** (vs. a static ad) change the disclosure a member must make, or our endorsement/FTC posture?
- The member posts a link that leads to a live sale — does that make the member a "seller's agent" or create any liability for the member or us?
- Real multi-platform video simulcast (RTMP to YouTube/Facebook/Twitch) is a separate, stream-key-gated path — do those platforms' terms or any additional disclosures need review before we enable it?

## 5. Live-shopping sales & the closed loop

**What it does.** Viewers buy featured products with Site Cash (points); business sellers are paid real money through the existing order/fulfillment pipeline; users only ever transact in Site Cash. Live sales flow through the same money path already reviewed — live shopping adds no new money-movement mechanism.

**Questions for counsel:**
- Does selling **live** change any seller obligations (KYC, 1099/tax, sales-tax collection, product-liability disclosures) vs. our existing marketplace sales?
- Impulse/"limited time" live-selling pressure — are there any FTC or state rules on urgency claims, countdowns, or "only X left" messaging in a live context we should constrain?
- Confirm the closed-loop posture (users get only Site Cash; businesses get real money) is unchanged and acceptable in the live-selling context.

## 6. Advertiser packaging — livestream included at the same price

**What it does.** In the advertiser value stack, live-shopping placement and livestream→social distribution are shown as **included** features at **no extra price** (~$13,000 of conventional value combined), marked "included — activates after counsel sign-off." The system reports a *listed/delivered value ratio*, never a revenue or ROI promise.

**Questions for counsel:**
- Is the "included, activates after counsel sign-off" framing acceptable — i.e., showing a feature's conventional value in the package while it is disabled, so long as it is clearly not yet delivering and not promised as a return?
- Any concern with attaching a specific dollar "conventional value" to these placements in advertiser-facing materials?

---

## What we need from you

1. A go/no-go (and any conditions) on enabling each of the six areas above.
2. Specifically, the **moderation + DMCA-agent + content-policy** requirements for §3 (broadcast), which is the gating item for scale.
3. Any disclosure language you want us to use for: the in-stream ad break (§2), the social announcement (§4), and the advertiser value-stack framing (§6).

Until we hear back, all of this stays disabled. See also: `HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF.md`, `LIVESTREAM-ADVERTISING-INTEGRATION.md`, `QVC-SCALE-BROADCAST.md`, `SOCIAL-ENDORSER-AND-REFERRAL-LEGAL-BRIEF.md`, `AI-CONTENT-DISCLOSURE-DESIGN.md`.
