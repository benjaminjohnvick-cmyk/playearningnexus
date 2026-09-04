# Browser Extension — Attention Rewards, Affiliate & Advertiser Inventory (Design Spec)

*Design/spec document for the Google Chrome extension that rewards users in closed-loop Site Points for viewing
the platform's own advertiser inventory and for shopping through affiliate links. Written to be reviewed BEFORE
any code is built. Not legal advice — it flags the questions for counsel. Prepared 2026-09-04.*

---

## 0. The one rule this whole design obeys

**Show our OWN inventory on surfaces the extension legitimately controls; earn affiliate commissions only on
sales we genuinely referred; never touch, replace, or re-attribute anyone else's ads or affiliate credit.**
Users are paid in **closed-loop, non-cashable Site Points** that auto-deposit into their account. Real money
comes only from *our* advertisers (who agreed by contract) and from affiliate networks (whose merchants already
agreed to pay commissions). Every earned dollar is written to the existing `RevenueEvent` ledger.

This is the compliant version of "an extension that pays users a cut of ad revenue." It deliberately does **not**
do the thing that gets extensions removed and sued — see §7.

---

## 1. The three populations and how each one opts in

The request touched three different parties. They opt in three different ways, and conflating them is where the
legal risk hides.

| Party | How they get in | Can it be automatic? |
|---|---|---|
| **Users** | Install the extension from the Chrome Web Store (explicit) → auto-enrolled in *rewards* (opt-out) → *tracking* layer is separate opt-in | **Install cannot be forced.** Reward enrollment after install can be default-on (opt-out). Tracking is opt-in. |
| **Our advertisers** | Sign the advertising agreement, which includes an **extension-inventory clause** (default-on, opt-out, disclosed) | **Yes** — by contract, B2B, logged in the consent ledger |
| **Affiliate merchants** | Already enrolled in the affiliate **networks** we join as a publisher | **N/A** — we don't sign them; the network already did |

---

## 2. User side — reward enrollment (install = opt-in)

**Install is the opt-in.** A Chrome extension must be manually installed and its permissions granted by the
user; there is no silent or forced install (outside enterprise MDM, which isn't our case). That install + the
Chrome permission prompt IS the consent — the cleanest we get.

**After install, two separate layers:**

- **Layer A — reward enrollment (default-ON, opt-out).** On install the user is auto-enrolled in the rewards
  program: they earn Site Points for viewing our own advertiser inventory on the extension's surfaces (its
  **new-tab page** and **popup/side panel**), and cashback points when they shop through affiliate links. This
  is first-party ad *serving* on surfaces we control — no cross-site tracking — so default-on with a one-tap
  opt-out is appropriate (mirrors how the in-app interstitials / 9th-minute ad are already default-on). A clear
  **"Extension Rewards"** toggle lives in their account settings and in the extension popup.
- **Layer B — browsing/attention layer (opt-IN, globally).** Anything that reads the *pages the user visits*
  to target or measure (behavioral profiling across the web) is a separate, explicit **opt-in**, disclosed on
  its own screen. GDPR requires opt-in for advertising/profiling for EU users; we make it opt-in **globally**
  to hold the strictest standard (same principle as the cookie-consent banner and the auto-renewal notices).
  A user can run Layer A (earn on our surfaces) without ever enabling Layer B.

**Points auto-deposit.** Rewards credit to the user's `points` balance via the existing `adjustUserBalance`,
tagged as promotional where funded by us, and are non-cashable closed-loop Site Points — consistent with the
whole economy. Nothing here is a cash-out.

**Settings (all gated; the master switch is counsel-gated + OFF):**
`EXTENSION_ENABLED` (master, sensitive, default 0, counsel-gated), `EXTENSION_REWARDS_DEFAULT_ENROLLED` (1,
opt-out posture for Layer A), `EXTENSION_TRACKING_REQUIRE_OPTIN` (1, forces Layer B opt-in),
`EXTENSION_REWARD_PER_IMPRESSION_POINTS`, daily/lifetime reward cost caps (sensitive governors).

---

## 3. Affiliate-network piece — Honey's model, done clean

**How the money actually works.** We join affiliate networks (CJ, Rakuten, Impact, ShareASale, Amazon
Associates, etc.) as a **publisher**. Those networks already contain tens of thousands of merchants who have
*already agreed* to pay affiliate commissions on referred sales. When a user (with the extension) buys from a
participating merchant, the network pays us a commission; we share a portion back to the user as closed-loop
Site Points. This is the same core model as Honey — and it's essentially what `SHOPPING-EXTENSION-AND-SERVICES.md`
+ `shopping.ts` already scaffold.

**The clean-attribution rules (this is the part that keeps us out of the Honey lawsuit).** Honey's legal
exposure came from **attribution hijacking** — injecting its own affiliate cookie at checkout to claim credit
for sales it didn't drive, stealing commission from creators/publishers who did. We do the opposite, enforced
in code:

1. **Never override an existing affiliate cookie.** If another party's affiliate attribution is already present
   for that merchant/session, we do **not** replace it. We only attach ours where none exists.
2. **Only claim credit for genuine referrals** — a real click-through/engagement the user took via our surface,
   not a last-second checkout injection.
3. **Respect last-click / creator attribution** and each network's and merchant's attribution rules.
4. **Full disclosure** to the user that a purchase may earn the platform a commission, of which they get a share.

**Revenue:** commission is booked to `RevenueEvent` as `affiliate_commission`; the user's share is a
closed-loop points grant (a subsidy/cost against that commission). Ties into the existing `affiliate` /
`shopping` SDK and the `AFFILIATE_STOREFRONT_ENABLED` gated lever.

---

## 4. Advertiser side — the agreement clause + campaign eligibility flag

**The clause.** The advertising agreement gains an **extension-inventory clause**: *by advertising with us, the
advertiser agrees their ad inventory may run across all of our owned surfaces — site, apps, and browser
extension — at the rate card.* This is **B2B**, affirmatively agreed at signup, and **disclosed** (not a hidden
term). Posture: **default-ON, opt-out** for advertisers (fine for B2B, unlike the consumer tracking side) so we
get near-universal inventory coverage without hard-forcing anyone. An advertiser can opt a campaign out.

**Why it holds up.** Affirmative agreement + B2B + clear disclosure. Bundling our own ad products is routine
(everyone from Google to Meta does it). The only doctrine counsel glances at is antitrust **tying** — which
requires real market power in the "must-buy" product to bite; as a new entrant we have none, so it doesn't
realistically apply. The requirement that matters is **clear disclosure** in the agreement (surprise terms are
where UDAP/deception claims come from).

**Mechanism (reuses what exists).** It's a clause in the advertiser agreement surfaced through the existing
terms-acceptance flow (`acceptTerms`) and logged in the **consent ledger** (`recordConsent`), plus an
**`extension_eligible`** boolean on each campaign (default true, advertiser can toggle off). The extension's
ad slots draw only from the pool of `extension_eligible` campaigns. This solves "where does the extension's ad
inventory come from" — it always has our own advertisers to show.

**Settings:** `EXTENSION_ADVERTISER_DEFAULT_ELIGIBLE` (1, opt-out), `EXTENSION_AD_RATE_CARD_*` (pricing),
`EXTENSION_INVENTORY_CLAUSE_VERSION` (ties the accepted clause version into the consent ledger).

---

## 5. Revenue model — two distinct types, one ledger

The request blurred two revenue types; the design keeps them distinct and books both to `RevenueEvent`:

- **Ad revenue** — *our* advertisers pay for impressions/clicks on the extension's own surfaces (new-tab,
  popup). Booked as `advertising`. Advertisers signed up via §4. The user's reward comes out of this.
- **Affiliate commission** — merchants pay a % of a *sale* the user made through an affiliate link. Booked as
  `affiliate_commission`. Merchants "signed up" via the networks (§3).

In both cases the **user is paid in closed-loop Site Points** (a subsidy/cost against the revenue), and the net
margin is real money to the platform. The customer never pays a markup — the same invariant as the rest of the
revenue layer.

---

## 6. What the extension actually is (surfaces & permissions)

- **Surfaces it controls and monetizes:** its **new-tab page**, its **popup / side panel**, and an opt-in
  **"watch-to-earn"** view. These are ours; we place our advertiser inventory there. We do **not** inject ads
  into third-party pages.
- **Shopping helper:** on supported retailer sites, offers coupons/cashback via affiliate links with clean
  attribution (§3) — the legitimate Honey-style function.
- **Permissions:** kept as narrow as the function allows. Broad host permissions (needed only if Layer B
  tracking is enabled) are requested **at the point the user opts into Layer B**, not at install, and are
  covered by a privacy policy + Chrome's Limited Use requirements.
- **Platform reality:** an extension can only affect **web pages in Chrome** — not phone apps, other browsers,
  or device-wide ads. The design does not promise device-wide takeover (that would need a VPN/DNS product and
  is out of scope).

---

## 6b. Mobile home-screen ads — iOS vs Android (scope reality)

The same "reward attention" idea does **not** extend to a phone's home screen the way it does to a browser
surface, because the mobile OSes are far more locked down than Chrome.

- **iOS — no ads on the home/lock screen, and no equivalent to the Android launcher/lock-screen model.** Apple
  doesn't allow **custom launchers** (you can't replace or set a default home screen on iPhone), doesn't let
  apps draw on the **lock screen** or run overlays, and its App Review Guidelines **prohibit ads in widgets and
  in notifications**. So the Slidejoy/Fronto-style lock-screen ad model was never and is not possible on iOS.
  The one legitimate iOS surface is a **WidgetKit widget** (home-screen and, iOS 16+, lock-screen) plus Live
  Activities: it can show **our own content** — points balance, streak, "tap to earn today's reward," today's
  offer — and **deep-link into the app**, but it **cannot display third-party ads itself**. So the "iOS version"
  is a **content/engagement widget, not an ad surface**: a persistent hook on the home/lock screen that pulls
  the user back *into* the app, where the ad-viewing + point-earning actually happens (allowed there). Valuable
  for the flywheel (drives daily app opens → more in-app impressions), just not "ads on the home screen."
- **Android — the widget hook works the same, plus a riskier extra option.** Google Play / AdMob policy also
  requires ads to live **inside the app's own UI** — ads in home-screen *widgets*, *notifications*, or *overlaid
  on other apps* are prohibited (disruptive/out-of-app ads) — so the compliant path is the **same content widget
  that deep-links into the app** as on iOS. Android *additionally* allows two user-adopted surfaces iOS doesn't:
  a **lock-screen reward app** (the old Slidejoy/Fronto model — user-installed, opt-in, historically a removal
  risk) and a **custom launcher** the user sets as default (a large separate product). Both are Android-only and
  policy-sensitive.
- **Where iOS and Android converge:** on **both**, the home/lock-screen presence is a **content widget that
  deep-links into the app** — no ads on the widget itself; ads + rewards happen inside the app (already built).
  The only divergence is that Android *also* has the riskier launcher/lock-screen-ad option if ever wanted.
- **Compliant mobile scope for now:** ads + rewards **inside our own app**, plus a cross-platform **content
  widget** (iOS WidgetKit + Android app widget) as a re-engagement hook. Any Android lock-screen/launcher
  "home-screen ads" build is a **separate, Android-only, gated + counsel/policy-reviewed track**, not part of
  this system. Store policies tighten over time — confirm current policy before building.

---

## 7. Deliberately NOT built (the guardrail list)

Each of these is where extensions get removed from the store, flagged as adware, or sued — none are in scope:

- **No replacing/injecting ads on third-party sites.** We never take over other publishers' ad slots (revenue
  theft / tortious interference / Chrome Web Store violation / adware classification).
- **No affiliate-attribution hijacking.** We never override an existing affiliate cookie or claim credit for a
  sale we didn't drive (the Honey lawsuit behavior).
- **No forced user install and no silent tracking.** Install is the user's act; the browsing layer is opt-in.
- **No device-wide ad takeover** (technically impossible for an extension; out of scope).
- **No auto-billing of merchants we don't have a contract or network relationship with.**

---

## 8. For counsel (review before the master flag is turned on)

1. **Advertiser agreement** — the extension-inventory clause: tying/disclosure language, opt-out mechanics,
   consent-ledger capture.
2. **User consent** — Layer A (opt-out) vs Layer B (opt-in) split; EU opt-in for any profiling; privacy policy
   + Chrome Limited Use disclosure for host permissions.
3. **Affiliate attribution** — the clean-attribution rules (don't override existing cookies; respect last-click)
   and each network's publisher terms.
4. **Chrome Web Store policy** — confirm the surfaces/permissions model passes review (own-inventory only, no
   injection) and the extension is not classifiable as ad injection/adware.
5. **Rewards** — that closed-loop points remain non-cashable and don't create a cash-equivalent.

---

## 9. Where it wires into the existing code (for the build)

- **Ad inventory / waterfall:** the extension ad slots read from `extension_eligible` campaigns via the existing
  ad selection (`interstitial-ad.ts` / ad-waterfall) — a new surface, same inventory engine.
- **Affiliate:** reuses `shopping.ts` / the `affiliate` SDK and `AFFILIATE_STOREFRONT_ENABLED`; adds the
  clean-attribution guard.
- **Rewards:** `adjustUserBalance` (points), tagged promotional; booked via `recordRevenue` /
  `recordSubsidy`.
- **Consent:** `acceptTerms` + `recordConsent` (advertiser clause + user layers) — the ledger already exists.
- **Gating:** all behind sensitive, default-OFF flags; `EXTENSION_ENABLED` is counsel-gated in `LEGAL_BRIEFS`;
  everything surfaces in the Setup Wizard like the other gated levers.
- **Registry:** add the extension as revenue-lever sub-points (ad inventory + affiliate) in
  `revenue-levers.ts`, status "gated" (needs the published extension + affiliate-network accounts + counsel).

---

## 9b. Built implementation (2026-09-04) — what's now coded

The backend and the signup flow are built (gated OFF); the extension client is coded to ~100% (only the Web
Store publish, affiliate-network deep links, and ad creatives remain, which need external accounts).

- **Ad-serve endpoint — `extensionAdServe`** (authenticated, read-only). Returns ONE creative for the
  extension's own surface: it picks from active `AdCampaign` rows left `extension_eligible` (the disclosed
  inventory clause), and when there's no paid inventory it returns a **house cross-sell** (refer / Premium /
  spend) so the slot is never empty and never billed. It never credits — the reward happens only after a real,
  user-initiated completed view via `extensionAdReward` (which enforces the daily/lifetime caps). Never injects
  into third-party pages.
- **Chrome Web Store URL — `EXTENSION_WEBSTORE_URL`** (string setting, default blank). Your published listing
  URL; the signup opt-in opens it. Returned by `extensionConfig` so the client/site know where to send users.
- **Signup pre-checked opt-in flow.** A website **cannot auto-install** a Chrome extension (inline install was
  removed in 2018; sideloading is blocked), so the compliant maximum is built instead: after signup, `AuthForm`
  routes to the **`GetExtension`** step (`ExtensionInstallPrompt`), a **pre-checked, default-on, opt-out** card.
  On continue it records the choice via `extensionEnroll({ install_intent })` (stored as `extension_install_intent`
  so you can nudge non-installers) and **auto-opens `EXTENSION_WEBSTORE_URL`** in a new tab — one click from
  "Add to Chrome." It no-ops straight through if the extension isn't live or no store URL is set.
- **Client (the `gg-extension` project).** New-tab surface calls `extensionAdServe`, renders the creative,
  enforces a 5-second minimum view, then credits via `extensionAdReward`; popup + options (rewards opt-out,
  shopping-helper permission, off-by-default personalization) + background worker + icons all done. Archived in
  Bundle 38 under `09 - Browser Extension`.

---

## 10. Suggested build order (when greenlit)

1. **Advertiser clause + `extension_eligible` flag** — pure backend/terms; no user-facing risk; makes inventory
   exist. Gated OFF.
2. **Backend reward + settings + ledger wiring** — enrollment, points grant, caps, consent — all gated OFF.
3. **The extension itself** (separate Chrome project) — new-tab/popup surfaces, shopping helper with clean
   attribution, opt-out control; submitted to the Web Store for review.
4. **Layer B (opt-in tracking)** — last, separately gated, only if wanted.

Each step is independently gated and reversible. Nothing bills, tracks, or pays until you connect the affiliate
accounts, publish the extension, and counsel clears the master flag.

---

*None of this is legal clearance — it's an organized map of the design and its open questions so counsel can
review efficiently before the master flag is enabled.*
