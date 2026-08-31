# Design Spec — Buddy Chat Social Shop, Omni-Channel Live, Survey-Test, Translation & Tutorial

*A single blueprint folding the new features into what already exists. Nothing here changes the compliance
spine: **users only ever receive Site Cash; businesses/sellers are paid real money; money & identity stay
server-authoritative; everything new ships gated OFF and appears in the Setup Wizard automatically.** This is the
approved design; build follows on your go-ahead.*

---

## 1. Buddy Chat becomes the unified social-commerce-hosting hub

Buddy Chat already hosts a version of social shopping. We make it the single surface that also contains the **AI
Social Shop** and all **four hosting options** built this session, so users don't jump between screens.

Inside a Buddy Chat thread or room, a user can:

- **Shop** — browse the AI Social Shop inline (top sellers, catalog, a friend's picks).
- **Host** one of the four options, launched right from chat: (1) a **game/skill tournament** (Site-Cash prizes),
  (2) **paid-access virtual content** (Site-Cash donation or survey), (3) **retail / live shopping** (sell
  products), (4) **stream / screen-mirror**.
- **Go live** to the Omni-Channel Livestream (§3) with one tap, with the consented social simulcast.

Implementation: Buddy Chat gets a "＋" action menu (Shop / Host / Go Live / Survey-Test) that calls the existing
`sessionHostAssign`, the social-shop endpoints, and `sessionSimulcast`. One gate, `BUDDYCHAT_SOCIAL_SHOP_ENABLED`,
turns the whole hub on; the individual hosting gates from this session still apply underneath.

---

## 2. AI Social Shop

### 2a. Fee model — mirror Facebook Marketplace (replaces the 50/50 split)

For **retail / live-shopping** sales, drop the 50/50 split and charge the **seller** a Facebook-Marketplace-style
fee:

- **Shipped / checkout orders:** **10% of the buyer-paid total, minimum $0.80**, taken from the seller's
  proceeds.
- **Local pickup:** **no fee** (a separate no-fee path).

Everything else holds: the **buyer pays in Site Cash**, the **business seller is paid real money** (their total
minus the 10% fee) through the existing order → funds-release pipeline, and a **user** seller is credited Site
Cash. The platform's revenue is the fee, recorded to the existing revenue ledger.

*Code change:* replace `revenueSplit()` for the retail modes in `hosting-monetization.ts` with a
`marketplaceFee(total, {shipped})` → `{ fee, seller_net }` (10%/$0.80 shipped, $0 local); wire it into
`liveShoppingOrder`. New settings: `SOCIAL_SHOP_FEE_PCT` (default 10), `SOCIAL_SHOP_FEE_MIN` (default 0.80),
`SOCIAL_SHOP_LOCAL_FREE` (default true).

### 2b. Auto-display the top-selling 10 items

The shop front automatically shows the **current top 10 sellers** (by units/revenue over a rolling window), no
manual curation. A `topSellers(window)` query ranks orders; a `SocialShopTopTen` view refreshes on a schedule and
renders as the default storefront in Buddy Chat.

### 2c. Auto-post top sellers to the Omni-Channel Livestreams

When an item enters the top sellers, the platform **automatically features it** on the corresponding Omni-Channel
Livestream (§3) and posts it across social via the **existing consented one-tap posting + #ad disclosure** and the
**RTMP simulcast**. The post/segment is generated from the product (image + short commercial, §3). Governed by the
same consent rules — only the user's own connected, consented accounts.

---

## 3. Omni-Channel Livestream — a shopping category with subcategories + AI images & commercials

Add **"Omni-Channel Livestream"** as a **top-level shopping category**, structured with **subcategories that
mirror your existing shopping sections** (so it lives alongside the catalog, not as a separate silo). For the
products being sold, the platform **auto-generates images and short commercials** using the **Abacus.AI video
engine** already wired (`video-render.ts`), so the creative stays tied to the live catalog.

- Each subcategory = a live "channel" of related products.
- For each featured product: an AI product image + a short AI commercial (disclosed as AI + `#ad`, never a real
  person, no guaranteed-results claims — same rules as the AI-host fallback).
- The AI-hosted fallback (built this session) and the top-seller auto-feature both publish into these channels,
  so everything — catalog, livestream, and social — stays one connected system.

*Build:* extend the catalog taxonomy with the new category + subcategories (reusing the existing
category/subcategory + tile-image generators); a `livestreamChannelBuild` job renders the images/commercials per
featured product on the serverless GPU, bounded per run.

---

## 4. Survey-Test-First — for users unsure whether to sell a product or host a video

A user who isn't sure a product/video will land can **validate it first, for free**, instead of committing:

- **Free to create.** Creating a product-validation survey costs the user nothing.
- **Advertiser-funded PPC survey.** Respondents complete an ~8-minute PPC survey and earn the **full standard
  reward in Site Cash** (advertiser-funded; the creator isn't charged, and the reward isn't skimmed).
- **Feedback, not a promise.** The creator gets aggregated results — interest level, price sensitivity, comments
  — a "will it sell?" read they use to decide whether to list the product or host the video. It is explicitly a
  **feedback signal, never a guaranteed-sales claim.**

This reuses the existing survey/PPC system; the new part is a lightweight "validation survey" template and a
results summary card that feeds into the decision to publish. Gate: `SURVEY_TEST_FIRST_ENABLED`.

*(One point to confirm when we build: the phrase "keep the full $8" — I've designed it as the respondent keeping
the full advertiser-funded reward and the creator paying nothing to test. If you meant the creator keeps $8 of
advertiser value per completion instead, it's a small change — tell me which at build time.)*

---

## 5. Universal Translation AI Agent (reliable design)

**Goal:** a user opens the app and everything is in their language and specific dialect; support essentially every
language and dialect; self-improve over time; stay storage-light.

**How it works (reliable path):**

1. **Detect** the user's language/dialect from their device locale and the text they actually type (the AI reads
   the text directly — no screenshots needed).
2. **Translate** with the AI's built-in multilingual translation, which already covers virtually all written
   languages and a very wide range of dialects — so there's nothing to "install" per language.
3. **Dialect & rare-language layer (the part that truly self-learns):** a small **glossary** stores only the
   *deltas* — dialect-specific word choices, regional spellings, and local terms — keyed by language+dialect.
   When a user corrects a translation or a native speaker confirms a phrasing, that correction is remembered and
   applied next time. This is storage-light by design: we store **corrections, not languages** (a few KB of
   glossary per dialect, not a whole model).
4. **Self-improvement loop:** frequent corrections graduate into the shared glossary for that dialect (with light
   moderation), so accuracy climbs as more people use it — the "learns and remembers dialects" outcome you want,
   achieved by accumulating a correction glossary rather than pangrams or screenshots.

**Why not the literal screenshot/alphabet/pangram method:** the AI already has the text (no screenshot needed) and
already knows the alphabets (no web search per message), and it doesn't store languages as text to "add" — so the
literal method would be slower, costlier per message, and less accurate for the exact same goal. The glossary is
the honest home for the "learning" part.

*Privacy note:* because it uses the typed text (not screenshots of the user), there's no screen-capture data to
secure. Corrections are content, not identity.

*Build:* a `translateAgent` function (detect → translate → apply glossary), a `DialectGlossary` store
(language, dialect, term, preferred, confidence), and a `translationCorrection` endpoint that feeds learning.
Auto-translate on app open behind `AUTO_TRANSLATE_ENABLED`.

---

## 6. End-to-end interactive tutorial + downloadable guidebook

**Interactive tutorial (in-app):** a guided, role-branched walkthrough that runs the first time and is replayable
from Help.

- **Choose your path at the start:** *Business* or *Non-business* — the tutorial branches accordingly.
- **Non-business path:** how to earn (surveys/offers/buddy chat), the daily unlock, Site Cash & what it buys,
  shopping, hosting a casual game, and cashing value into goods.
- **Business path:** setting up as a seller (KYC/tax), listing products, the AI Social Shop & fee, running an
  Omni-Channel Livestream, survey-testing a product, ads, and payouts in real money.
- **Format:** step highlights over the real UI (coach-marks), each step interactive ("try it") with a skip/next,
  progress saved, and a completion reward. Content is translated by the agent in §5.

**Downloadable guidebook (for all users):** a single polished **PDF** covering both paths end to end — same
content as the tutorial in reference form, with screenshots/diagrams, a quick-start for each user type, an FAQ,
and the Site-Cash/earnings rules stated plainly (and honestly — value delivered, never guaranteed income).
Generated from one source so the tutorial and guidebook never drift.

---

## 7. Compliance carried through (unchanged invariants)

- **Users only ever receive Site Cash; businesses are paid real money.** True across the shop fee, survey
  rewards, tournaments, and livestream sales.
- **AI commercials/hosts** are disclosed as AI + `#ad`, never depict a real person, and make no guaranteed
  results claims.
- **Social posting / simulcast** only ever uses a user's own connected, consented accounts, per post, with
  `#ad`.
- **Survey-test is feedback, not an income promise.**
- Everything new is **gated OFF** and auto-listed in the Setup Wizard (enforced by the audit check).

---

## 8. Build map (what changes where, when you say go)

| Feature | Reuses | New pieces |
|---|---|---|
| Buddy Chat hub | Buddy Chat, `sessionHostAssign`, social-shop, `sessionSimulcast` | `＋` action menu; `BUDDYCHAT_SOCIAL_SHOP_ENABLED` |
| FB-style fee | `liveShoppingOrder`, revenue ledger | `marketplaceFee()`; 3 fee settings |
| Top-10 + auto-feature | Orders, social posting, simulcast | `topSellers()`, `SocialShopTopTen`, auto-feature job |
| Omni-Channel Livestream category | Catalog taxonomy, category-image + `video-render` (Abacus) | new category+subcategories, `livestreamChannelBuild` |
| Survey-Test-First | Survey/PPC system | validation-survey template, results card, gate |
| Translation agent | AI translation | `translateAgent`, `DialectGlossary`, `translationCorrection` |
| Tutorial + guidebook | Existing UI, translation agent | interactive coach-marks, single-source PDF generator |

*Estimated as several build passes; the fee change, top-10, and Buddy Chat wiring are the fastest wins and a good
first pass.*
