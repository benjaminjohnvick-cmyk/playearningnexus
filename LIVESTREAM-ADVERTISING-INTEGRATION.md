# Livestream × Advertising Ecosystem

*The livestream is now a placement of the ad system: only advertised products can stream, and targeted audio/video ad breaks run between product segments.*

**What changed:** live shopping is no longer a separate feature bolted onto hosting — it's wired into the same advertising ecosystem that powers every other placement. Two rules make it so, both **on by default**:

1. **Only advertised products can be streamed or sold.** A host can feature/sell a product only if it has an active ad creative in the system. Every streamed product is a paying/earned advertiser's product.
2. **Audio/video ad breaks run between products.** When the host moves to the next product, viewers first see a targeted audio or video ad from your own inventory — the same ads served everywhere else — and the impression is your ad revenue.

---

## 1. Advertised-products-only

Setting: `HOSTING_ADVERTISED_PRODUCTS_ONLY` (default **on**).

When a host features a product (`sessionFeatured`) or a viewer buys one (`liveShoppingOrder`), the backend checks it against the active ad inventory (`AdGridAd` creatives) via `advertised-products.ts::checkStreamable`. A product matches if its name or URL matches an active creative. On a match, the featured item is stamped with the **advertiser linkage** (`ad_grid_ad_id`, `advertiser_user_id`) so the stream ties back to the campaign for attribution. No match → the action is refused with a clear message: *"Only advertised products can be streamed — create an ad for it first (it becomes streamable automatically)."*

The effect: the livestream becomes a **premium ad placement**. An advertiser's product doesn't just sit in a grid — it can be featured live, sold live, and the moment they run an ad for a product it becomes eligible to stream. Turn the rule off (`HOSTING_ADVERTISED_PRODUCTS_ONLY = 0`) to allow any catalog product, but the default keeps the stream inside the ad ecosystem.

---

## 2. Audio/video ad breaks between products

Settings: `HOSTING_AD_BREAK_BETWEEN_PRODUCTS` (default **on**), `HOSTING_AD_BREAK_SECONDS` (default 15).

When the host advances to the next product, an **ad break** plays for viewers first (never before the very first product — it's *between* products). The break is served by a new endpoint, `sessionAdBreak`, which draws from the **same inventory as the in-app interstitials** — `pickInterstitialAd` (founding → PPC → earned → house), targeted to each individual viewer — and returns the creative's resolved **audio/video** media. It's rendered by the existing `AdMedia` player (video autoplays muted with tap-to-unmute; audio plays over its poster), and a completed view records an `AdImpression` with placement `livestream_ad_break` — so it meters founding/make-good owners and books as your ad revenue exactly like every other placement.

Delivery works for both viewer tiers:

- **Interactive (WebRTC)** viewers get an `ad_break` signal over the data channel and run the break instantly.
- **Broadcast (HLS)** viewers, who poll `sessionFeatured`, see a fresh `ad_break_at` timestamp and run the break on their next poll.

Each viewer gets their **own** targeted ad, so 50 viewers or 50,000 viewers each see a relevant creative — and every one is a counted impression.

---

## 3. Included in every ad package — same price, more ROI

Live streaming is not a paid add-on. It's folded into the advertiser value stack as **included placements** at **no extra price**, so an advertiser's existing spend now also buys live-shopping video placement and social distribution — the delivered-value ratio (and ROI) climbs while the price holds. Two entries were added to the advertiser feature catalog (`advertiser-features.ts`), available from Tier 1 up:

- **`live_shopping_placement`** (~$8,000 conventional value) — a host features and sells the advertiser's product live, with audio/video ad breaks.
- **`livestream_social_amplification`** (~$4,000 conventional value) — the advertiser's live session is pushed to members' social feeds.

Both are marked *included — activates after counsel sign-off* (gated on `SESSION_HOSTING_ENABLED` / `HOSTING_SOCIAL_SIMULCAST_ENABLED`), so they show up in the advertiser's package as coming value and start counting toward delivered value the moment hosting is cleared. The advertiser pays the same, gets every form of advertising including live, and has a better shot at a return.

## 4. Live on members' social feeds

You already run user-amplified social advertising (opted-in members one-tap post advertisers' #ad creatives, and their reach counts as delivered impressions). Live streaming now plugs into that same pipe. A new endpoint, **`sessionSocialAnnounce`**, takes a live session and queues a *"🔴 LIVE now: <product> — watch & shop: <link>"* post (FTC #ad disclosure, a `WatchSession` link) to consenting members' connected feeds — reusing `socialPostContribution`, so the estimated reach flows into the advertiser's delivered value / ROI report exactly like every other amplified post. Only opted-in members are reached; each one-tap posts.

The host gets a **Share to feeds** button, and going broadcast fires it automatically (silently no-oping until `HOSTING_SOCIAL_SIMULCAST_ENABLED` is cleared by counsel). For real multi-platform video simulcast (RTMP to YouTube/Facebook/Twitch), the existing `sessionSimulcast` path applies where stream keys are provided. So a single advertised live session reaches: the in-app audience (WebRTC + HLS), and members' social audiences — from one stream.

## How it all connects

A host goes live → features an **advertised** product (linked to its campaign) → sells it in Site Cash through the existing order pipeline → moves to the next advertised product, and every viewer sees a **targeted audio/video ad** in between. The livestream now feeds three revenue surfaces at once: the marketplace sale (50/50 or seller fee), the ad-break impressions (advertiser spend / delivery), and the advertiser's product getting premium live exposure. It is, end to end, part of the advertising engine — not a side feature.

---

*All of this sits under the counsel gate: `SESSION_HOSTING_ENABLED` stays off until your attorney clears hosting; live shopping additionally needs `HOSTING_LIVE_SHOPPING_ENABLED`. The rules here define how the stream behaves once it's on. Verified by the load test (`deploy-kit/load-test.mjs`): advertised-only gating on both featuring and selling, and the ad break drawing from the shared inventory + recording revenue. See QVC-SCALE-BROADCAST.md and AUTONOMOUS-ADVERTISING-ENGINE.md.*
