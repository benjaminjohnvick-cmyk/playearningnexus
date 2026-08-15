# Get Goods Gratis — Reconciled State (2026-08-15)

*Single source of truth for the offer/pricing/compliance model across this folder. Where any other doc
disagrees with this one, this is current. Admin-tunable via settings; nothing here promises returns. Not
legal advice.*

## The offers (canonical)

| Offer | Price | How it's paid | Credit? | Status |
|---|---|---|---|---|
| **Founding Advertiser — Tier 1** | $12,000/yr or $1,000/mo | Upfront (normal purchase) | No | **Live** — the prominent offer on `/Apply` |
| **Tier 2 "Scale"** | $200,000 | 12 × 30-day pay-as-you-go parts, results-paced | No | **Live / available** |
| **Founding upgrade discount** | 5.5% off Tier 2 → $11,000 off → net $189,000 | Decoupled from what was paid (not a "credit"); dollar amount deliberately ≠ the $12,000 price | No | **Live**, 12-month window; perpetual for founding |
| **Premium gift boost** | up to $2,000 store credit | Premium-member benefit; collective advertiser pool, **decoupled from the fee** (not a rebate), member-directed, non-cashable, subject to availability | No (non-cashable) | **Live** (replaces the old $1,000 sign-up credit) |
| **Flexible Payment Terms** | splits a price into 4 quarterly card charges | Credit card only, 0%, ≤12 mo | **Yes — installment credit** | **OFF** — "coming soon" on `/Apply` |
| **Tier 1 "Pay From Results" (Financed)** | $0 down, $12,000 swept from earnings, balance DUE at term | Recourse | **Yes — recourse credit** | **OFF** — "coming soon" on `/Apply` |
| **Goods Advance** | store advance spent now, repaid from earnings | Non-recourse | **Yes — advance credit** | **RETIRED / superseded** — replaced by **Save-to-Get** (no-debt) for everyone and the **premium Boost** for premium members; stays OFF and is no longer featured in the Legal & Compliance docs (code retained, gated) |
| **Free earn-to-unlock advertiser** | — | earn ~$8k unlock + revenue-share | Non-recourse | **DISCONTINUED** (`FREE_ADVERTISER_TIER_ENABLED` OFF) |

## Flag posture

- **ON by default (launch with these, no lender/counsel gate):** `ai_funnel` (concierge + auto-launch + the
  `/Apply` founding CTA), Tier 2 pay-as-you-go, the founding upgrade discount, the $2,000 premium gift boost,
  product-stats + benchmark compilers, consent-gated email re-engagement, and the public `/Apply` page.
- **OFF by design (each a one-line flip once its external prerequisite lands):** `flexpay`, `tier1_financed`,
  `goods_advance` — every one needs its flag ON **+** a licensed/attorney-confirmed provider **+** a legal
  sign-off before it can originate. They are **marketed as "coming soon" on `/Apply`** while gated. Also off
  until their prerequisite: `card_charging`, `cash_out`, `p2p_transfers`, `store_credit_purchase`,
  `teen_accounts`, SMS marketing.

## Compliance spine (unchanged, applies everywhere)

- **Credit stays gated.** All three credit products ship disabled behind flag + provider + legal sign-off; the
  scaffolds never move money. Turning one on is a decision for after counsel.
- **Earnings/results claims: hypothetical → substantiated.** Show a clearly-labeled "how it works" example
  until real data passes the sample threshold (default 30), then auto-publish the real figure **with its
  basis**. A disclaimer does not cure an unsubstantiated claim, so no "typical return" is shown without data.
- **Revenue-share = platform-attributed sales**, non-recourse, counsel-gated — never a self-reported number,
  never a fixed debt.
- **Email:** consent-gated (`canEmailMarket`) with a CAN-SPAM footer; opt-IN required for CASL/GDPR regions.
- **`/Apply` captures leads only** (`AdvertiserApplication`) — no charge, no credit origination.

## Launch cost (from `LAUNCH-ESTIMATE-2026-07-30.md`)

Web PWA + Android ~$2,000–$2,800 year-one; add native iOS ~$2,900–$4,000. Hard external floor ~$40 shoestring
/ ~$139 with iOS. Recurring: AI/media/email ~$0 (cost floor + `AI_FORCE_CHEAP_TIER`), hosting ~$10–35/mo,
legal $0 at launch. Everything built this session ships prebuilt + ON, so the launch number did not rise.

## Documents in this folder (reconciliation status)

| Doc | Covers | Status @ 2026-08-15 |
|---|---|---|
| `RECONCILED-STATE-2026-08-15.md` | This index — canonical current state | Source of truth |
| `ADVERTISER-PRICING-2026.md` | Tier 1 price, upgrade discount, sign-up credit, revenue-share, discontinued free tier | Reconciled (banner added, `/Apply` cross-ref) |
| `APPLY-AND-COMING-SOON.md` | Public `/Apply` page, coming-soon financing, lead capture | New this session |
| `AI-FUNNEL-DESIGN.md` | Concierge two-gate funnel, email re-engagement, benchmarks | Reconciled (`/Apply` CTA noted) |
| `TIER2-SCALING-OFFER.md` | $200k in 30-day pay-as-you-go parts, deliverables, 5.5% discount | Current |
| `FOUNDING-ROLLOVER-AND-SIGNUP-CREDIT.md` | Decoupled 5.5% upgrade discount + retired $1,000 store credit | Current |
| `FLEXIBLE-PAYMENT-TERMS-COMPLIANCE.md` | Flex pay (installment credit, OFF), self-financed path | Current — marketed "coming soon" on `/Apply` |
| `TIER1-FINANCED-PAY-FROM-EARNINGS.md` | Recourse "pay from earnings" (OFF) | Current — marketed "coming soon" on `/Apply` |
| `PRODUCT-STATS.md` | Per-product real results, published at sample threshold | Current |
| `COST-FLOOR-AND-LOW-LEGAL.md` | One-click cost floor, `AI_FORCE_CHEAP_TIER`, lowest legal cost | Current |
| `HANDWORK-TEMPLATE.md` | The only manual steps, fill-in-the-blank | Reconciled (`AdvertiserApplication` + `/Apply` added) |
| `LAUNCH-ESTIMATE-2026-07-30.md` | Reconciled launch cost (2026-08-15 banner) | Reconciled (`/Apply` in banner list) |

## Two open decisions (status)

1. **Upgrade-discount daylight — RESOLVED (2026-08-15).** `FOUNDING_UPGRADE_DISCOUNT_PCT` is now **5.5%**
   (default), so the discount is **$11,000 off → net $189,000** — deliberately **not** the $12,000 that equals
   the Tier 1 price, removing the "return of capital" numeric coincidence. Still fully admin-tunable; just avoid
   setting it back to exactly $12,000.
2. **Which credit product (if any) to unlock first — still a COUNSEL DECISION (unchanged).** `flexpay`,
   `tier1_financed`, and the retired `goods_advance` all stay OFF behind flag **+** licensed provider **+**
   `*_LEGAL_SIGNOFF`. Nothing originates until you pick a path with your lawyer; the no-debt Save-to-Get and the
   premium Boost cover the member-facing need in the meantime, so this is not a launch blocker.
