# Apply Page + "Coming Soon" Financing — Public Advertiser Funnel

*The public `/Apply` page that markets the Founding Advertiser (Tier 1) offer, shows Tier 2 as available,
and lists the three financing options as "coming soon / apply now" while origination stays gated. It captures
a lead — it never charges anything or originates credit. Not legal advice. (As of 2026-08-15.)*

## Why it exists

The owner is talking to a lawyer before switching on the three credit products. So those are **marketed and
visible now** — framed as "coming soon / apply now" — while the code keeps origination gated. The Founding
offer, which needs no lender or counsel, is the **prominent** offer on the page and is open today.

## What the page shows

`/Apply` is **public** (reachable before login, so it works straight from an ad or link):

- **Founding Advertiser — Tier 1 (the prominent hero).** Navy/gold, the annual price ($12,000/yr) and the
  monthly option ($1,000/mo), a gold **"Limited space for advertisers"** banner, an **Apply now** button, and
  the full benefit list pulled live from settings:
  - 200,000 ad impressions/year, on a 4-year term
  - premier featured placement + sponsors-wall spot
  - free AI-written ad creative
  - ~30 AI social ad posts/month (clearly labeled)
  - A/B testing, analytics & sentiment insights
  - keep 100% of your own survey earnings for 4 years (as Site Cash)
  - Premium membership — premium members get the advertiser-funded gift boost (up to $2,000 in non-cashable store credit, subject to availability), a benefit decoupled from the price paid
  - 5.5% off the Tier 2 "Scale" upgrade — kept for life as a founding member
- **Tier 2 "Scale" — available now.** Shown as a live option: buy the $200,000 upgrade in 30-day
  pay-as-you-go parts. (See `TIER2-SCALING-OFFER.md`.)
- **Three financing options — "Coming soon."** Flexible Payment Terms, Tier 1 "Pay From Results," and Goods
  Advance render as coming-soon cards with a waitlist button. Their status is **driven by the real gate
  state**, so a card auto-flips to "Available / Apply now" the moment its flag + licensed provider + counsel
  sign-off turn it live — no code or copy change needed.
- **Scarcity + disclaimer.** "Limited space — the Founding tier is open until N advertisers enroll, then it
  closes" (`FOUNDING_ADVERTISER_SLOTS`), and a plain-English note that applying commits you to nothing and
  that coming-soon options are subject to approval and not offered yet.

## Lead capture — marketing only, no money

The apply form posts to `submitAdvertiserApplication`, which records the interest into a new
**`AdvertiserApplication`** entity (name, company, email, website, monthly budget, which offer, notes,
consent-to-contact, source). It:

- works **logged-in or anonymous** (captures the user id if present),
- requires a valid email so you can follow up,
- **never originates credit and never charges anything** — applying only starts a conversation,
- captures `consent_to_contact: true` because the person submitted the form to be contacted (still record a
  marketing opt-in before adding them to any bulk email — see the email-consent note in `AI-FUNNEL-DESIGN.md`).

## Concierge tie-in

The global AI concierge (`ConciergeLauncher`, see `AI-FUNNEL-DESIGN.md`) now carries an always-visible gold
**"Founding advertiser spots are limited — see the offer & apply →"** bar linking to `/Apply`, so the founding
offer and the coming-soon options are reachable from the concierge pop-up as well as the page.

## Where it lives in code

- Page: `/Apply` — public route in `src/App.jsx` (added to `publicPaths` and the public `<Routes>` block, and
  to the main authenticated routes). File: `src/pages/Apply.jsx`.
- Functions: `advertiserApplyInfo` (public read — returns the Founding offer + benefits + Tier 2 + the three
  coming-soon items with live gate status + scarcity/disclaimer); `submitAdvertiserApplication` (public write —
  captures the lead; no credit, no charge).
- Entity: `AdvertiserApplication` (global scope) — schema + rls added; registered in `entities.json`,
  `rls-policy.json`, `schema.sql`, and the function `_manifest.json`.
- Content is settings-driven: `FOUNDING_ADVERTISER_PRICE_USD`/`_MONTHLY_PRICE_USD`, `FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR`,
  `FOUNDING_ADVERTISER_TERM_YEARS`, `TIER1_AI_SOCIAL_POSTS_PER_MONTH`, `FOUNDING_SIGNUP_CREDIT_USD`,
  `FOUNDING_UPGRADE_DISCOUNT_PCT`, `FOUNDING_ADVERTISER_SLOTS`; the three coming-soon states read
  `flexPayLive` / `tier1FinancedLive` / `advanceProgramLive`.

The page markets the offers and collects interest. Turning a "coming soon" option live is still the same
three-part gate (flag ON + licensed/attorney-confirmed provider + legal sign-off) documented per product.
