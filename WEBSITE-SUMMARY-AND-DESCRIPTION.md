# Website Summary & Description — Get Goods Gratis (Free)

*A plain-language overview of the website and apps, prepared for counsel. Its purpose is to orient a lawyer
to **what the platform is, who uses it, what it does, and how it makes money** before turning to the
issue-specific documents in this packet. **Not legal advice** — it is a description of the product so that a
legal review is faster and better grounded. Current as of 2026-09-11.*

---

## 1. In one paragraph

**Get Goods Gratis (Free)** is an 18-and-over **retail / e-commerce marketplace** — a website plus companion
mobile apps — where people shop for goods and, alongside the storefront, can browse a searchable games category, take surveys, and
engage with advertising to earn on-platform store credit that is spent on those same goods. Its tagline is
**"Where Global Goods Gather"** — paired in the brand lockup with the descriptor **"Buy Anything Available
Online"** — and its intended web address is **getgoodsgratis.com**. The defining feature
is a **closed-loop economy**: everyday users never receive cash — what they earn stays as non-cashable
**store credit ("Site Cash")** usable only inside the platform — while **real money flows only between the
platform and businesses** (advertisers who buy campaigns, and partners such as affiliates and developers who
receive a revenue share). An AI layer generates and optimizes advertising and progressively automates routine
operations, with **permanent human/compliance gates** on anything touching money, identity, or legal matters.

---

## 2. What the site is (and is not)

- **It is** a consumer retail marketplace that bundles shopping with optional earn-and-reward mechanics
  (surveys, a searchable games category, attention/ad engagement, referrals, and a skill-based prize competition), funded by
  business advertising rather than by marking goods up to the consumer.
- **It is not** a bank, a money-transmitter, an investment or lending service, a cash-out "get paid" app, or
  a gambling site. Consumer balances are **closed-loop store credit**, not money; the prize competition is
  **skill/merit-based with a free entry option**, not a random-draw lottery.
- **Positioning note for counsel:** the brand repositioned from a "play games, earn" framing to a
  **retail-first** identity. Games are now **one searchable store category** among others, not a pillar and not a
  curated catalog: users search for any game available online and buy or download it through the store, on the
  **same zero-inventory sourcing/fulfillment model as every other product** (the store holds no inventory).
  Marketing copy across the site now leads with shopping; surveys/rewards and the games category are presented as
  secondary features. This matters for how the product is characterized (retail commerce vs. a rewards/gaming app).
  See `GAMES-TO-RETAIL-PIVOT-DECISIONS-2026-09-09.md` for the full decision record. `PENDING COUNSEL REVIEW (games→retail pivot, 2026-09-09).`

---

## 3. Who uses it (the audiences)

| Audience | What they do | Money direction |
|---|---|---|
| **Consumers (users)** | Shop for goods; optionally earn store credit by taking surveys, engaging with ads, and referring others; redeem credit for goods. Must be **18+**. | They spend money on goods and/or earn **non-cashable** store credit. **No cash is ever paid out to them.** |
| **Business advertisers** | Buy advertising campaigns and placements (tiered products, sponsored listings, boosts) to reach the user base. | They **pay real money to the platform.** |
| **Partners (affiliates / developers / endorsers)** | Refer business or supply integrations/content; receive a revenue share. | They **receive real money** as vendor/revenue-share payouts (1099-reported). |
| **Platform operator / admins** | Operate the marketplace, approve gated features, run compliance controls. | Receives advertiser revenue; pays partner shares and fulfills goods. |

---

## 4. What a user can do (core features & flows)

- **Shop the marketplace** — browse and acquire goods; store credit and/or payment methods apply at checkout.
- **Earn store credit** — complete surveys, engage with advertising/attention units, and complete
  daily/goal-based activities. The core ad-engagement surface is a **full-screen ad-grid experience**: the user
  taps **one** ad tile, which opens a full-screen takeover where the advertiser's video/audio loops through a
  short (30-second) watch gate; the questions then appear beneath the still-looping ad, the user submits
  (credited server-side), the real product page reveals, and the user **swipes straight to the next ad** —
  tapping the grid only once. Earnings accrue as **Site Cash** (closed-loop credit), never cash.
- **Refer others** — a **single-tier** referral program (no multi-level/downline structure); referral rewards
  are tied to real activity and are clawback-gated against fraud.
- **Enter the prize competition** — a **skill/merit-based** prize pool with a genuine **no-purchase-necessary
  (AMOE)** free-entry path; 18+ and jurisdiction-gated; official rules generated from settings.
- **Social / community features** — e.g., "Buddy Chat," social shopping, and community surfaces (several are
  gated and enabled selectively).
- **Account, privacy, and legal surfaces** — in-app Privacy Policy and Terms pages (public), consent capture,
  and a working tracking opt-out.

Business-facing flows include campaign purchase, tiered advertiser products (Tier 1–3), sponsored listings,
deposits/prepayment options, and AI-assisted creative — described in the monetization and compliance docs.

---

## 5. How the money works (the closed loop)

The economic model is the single most important thing for a legal reviewer to understand:

- **Inbound:** businesses pay the platform for advertising and placements (the platform's primary revenue).
- **Consumer side:** users earn **store credit only** — it is non-cashable, cannot be withdrawn, and is spent
  exclusively on goods within the platform. This is enforced at every money rail and automation.
- **Outbound cash:** real cash leaves the platform **only to business partners** (affiliates, developers,
  advertisers) as a revenue share / vendor payment, with tax reporting (1099) and backup-withholding wired in.
- **Why it's structured this way:** keeping consumer value closed-loop is a deliberate choice to stay clear of
  money-transmission and cash-out characterizations; paying only businesses keeps outbound flows as ordinary
  vendor payments. Counsel is asked to confirm this posture (see `FOR-YOUR-ATTORNEY.md` §1).

---

## 6. How it makes money (revenue streams, high level)

The platform is **advertiser-funded**. Revenue streams include tiered advertiser products (**Tier 1 entry,
Tier 2 "Scale," Tier 3 "Unlimited"**), a **founding pre-revenue offer** for early businesses, sponsored
listings and premium boosts, affiliate/partner revenue share, and other B2B advertising products.
**PPC network advertising is a shared feature included across all three tiers (Tier 1/2/3).** The **founding
pre-revenue offer grants the maximum (Tier 3) capability level of every feature, free** — a capability grant,
not an impression-volume one. Detailed
mechanics, pricing, and the auto-renew/deposit terms live in the monetization and pricing documents
(`PROFIT-FLYWHEEL-AND-MONETIZATION-BLUEPRINT.md`, `REVENUE-STREAMS-EXPANSION.md`, `ADVERTISER-PRICING-2026.md`,
and the Tier 2 items in `FOR-YOUR-ATTORNEY.md` §8–§9).

---

## 7. Technology & AI (what's under the hood)

- **Delivery:** a responsive **website (PWA)** plus **native/wrapped mobile apps** (Capacitor), backed by a
  **serverless back end** of roughly **980 functions across ~180 subsystem modules**.
- **AI advertising engine:** generates, tests, and optimizes advertising creative across owned and social
  surfaces (including AI-generated images/video).
- **Graduated-autonomy automation:** AI progressively takes over routine operational decisions under measured
  trust, but **permanent, non-overridable gates** keep human/compliance control over **money, identity, and
  legal** actions, plus a global kill-switch.
- **AI-content disclosure:** AI-generated creative carries a visible "AI-generated" label and machine-readable
  **C2PA content-credential** provenance (see `AI-CONTENT-DISCLOSURE-DESIGN.md`).

---

## 8. Compliance posture at a glance

The platform ships in a deliberately **conservative default state**; anything money-, credit-, minor-, or
chance-related is held OFF behind a named admin switch until counsel clears it. Highlights:

- **Age:** hard **18+** floor; teen/minor accounts gated OFF.
- **Consumer funds:** **closed-loop, non-cashable** store credit — not money transmission.
- **Prize competition:** **skill/merit-based + AMOE free entry**, jurisdiction-gated — structured to avoid a
  lottery/gambling characterization.
- **Earnings claims:** no forward earnings promises; results are hypothetical-until-substantiated; FTC-aligned
  advertising copy.
- **Privacy:** GDPR/CCPA-oriented consent + opt-out; session-replay analytics ship OFF.
- **Credit products:** exist only as gated scaffolding; cannot originate without a licensed provider **and**
  counsel sign-off.
- **AI content:** visible label + C2PA provenance to meet platform/FTC/EU AI-Act disclosure expectations.

The exact switches, defaults, and the specific questions for counsel are enumerated in
`FOR-YOUR-ATTORNEY.md` (compliance checklist) and the topic briefs alongside it.

---

## 9. Current status

The platform is **built to the conservative posture described above and is approaching launch** (pre-revenue).
The single developer/owner is **Ben Vick**; the source lives in the GitHub repository
`benjaminjohnvick-cmyk/playearningnexus`. Key blanks to fill before launch (business mailing address, DMCA
agent, governing-law/jurisdiction selections, terms version) are listed in `FOR-YOUR-ATTORNEY.md` §10.

---

## 10. Where to go next in this packet

- **Compliance sign-off checklist:** `FOR-YOUR-ATTORNEY.md` — the specific items needing a lawyer's approval.
- **Trademark:** `TRADEMARK-FILING-BRIEF.md` + `BRAND-AND-TRADEMARK.md` (marks, classes, filing drawings).
- **Patent:** `SOFTWARE-PATENT-FILING-STRATEGY.md` + `PATENT-FEATURE-AND-FUNCTION-DISCLOSURE-BRIEF.md`
  (invention disclosure and strategy).
- **Payments/merchant:** `PAYMENTS-ARCHITECTURE-AND-MERCHANT-BRIEF.md`.
- **Privacy & terms:** `PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`, `LEGAL-PAGES-GUIDE.md`.
- **Deeper compliance:** `COMPLIANCE-AND-ASSUMPTIONS.md`, `COMPLIANCE-AND-CURRENT-STATE.md`,
  `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`, `GLOBAL-COMPLIANCE-AND-LOCALIZATION.md`.

*Prepared for counsel. Not legal advice. This document describes the product as built; the operative legal
questions and the exact feature switches are in the documents referenced above.*
