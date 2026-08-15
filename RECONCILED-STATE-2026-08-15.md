# Get Goods Gratis — Reconciled State (2026-08-15)

*Single source of truth for the offer/pricing/compliance model across this folder. Where any other doc
disagrees with this one, this is current. Admin-tunable via settings; nothing here promises returns. Not
legal advice.*

## The offers (canonical)

| Offer | Price | How it's paid | Credit? | Status |
|---|---|---|---|---|
| **Founding Advertiser — Tier 1** | $12,000/yr or $1,000/mo | Upfront (normal purchase) | No | **Live** — the prominent offer on `/Apply` |
| **Tier 2 "Scale"** | $200,000 | 12 × 30-day pay-as-you-go parts, results-paced | No | **Live / available** |
| **Founding upgrade discount** | 6% off Tier 2 → $12,000 off → net $188,000 | Decoupled from what was paid (not a "credit") | No | **Live**, 12-month window; perpetual for founding |
| **Sign-up store credit** | $1,000 Site Cash | Vests over 12 mo; needs 12 mo active + feedback + 1 referral | No (non-cashable) | **Live** |
| **Flexible Payment Terms** | splits a price into 4 quarterly card charges | Credit card only, 0%, ≤12 mo | **Yes — installment credit** | **OFF** — "coming soon" on `/Apply` |
| **Tier 1 "Pay From Results" (Financed)** | $0 down, $12,000 swept from earnings, balance DUE at term | Recourse | **Yes — recourse credit** | **OFF** — "coming soon" on `/Apply` |
| **Goods Advance** | store advance spent now, repaid from earnings | Non-recourse | **Yes — advance credit** | **OFF** — "coming soon" on `/Apply` |
| **Free earn-to-unlock advertiser** | — | earn ~$8k unlock + revenue-share | Non-recourse | **DISCONTINUED** (`FREE_ADVERTISER_TIER_ENABLED` OFF) |

## Flag posture

- **ON by default (launch with these, no lender/counsel gate):** `ai_funnel` (concierge + auto-launch + the
  `/Apply` founding CTA), Tier 2 pay-as-you-go, the founding upgrade discount, the $1,000 sign-up credit,
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
| `TIER2-SCALING-OFFER.md` | $200k in 30-day pay-as-you-go parts, deliverables, 6% discount | Current |
| `FOUNDING-ROLLOVER-AND-SIGNUP-CREDIT.md` | Decoupled 6% upgrade discount + $1,000 store credit | Current |
| `FLEXIBLE-PAYMENT-TERMS-COMPLIANCE.md` | Flex pay (installment credit, OFF), self-financed path | Current — marketed "coming soon" on `/Apply` |
| `TIER1-FINANCED-PAY-FROM-EARNINGS.md` | Recourse "pay from earnings" (OFF) | Current — marketed "coming soon" on `/Apply` |
| `PRODUCT-STATS.md` | Per-product real results, published at sample threshold | Current |
| `COST-FLOOR-AND-LOW-LEGAL.md` | One-click cost floor, `AI_FORCE_CHEAP_TIER`, lowest legal cost | Current |
| `HANDWORK-TEMPLATE.md` | The only manual steps, fill-in-the-blank | Reconciled (`AdvertiserApplication` + `/Apply` added) |
| `LAUNCH-ESTIMATE-2026-07-30.md` | Reconciled launch cost (2026-08-15 banner) | Reconciled (`/Apply` in banner list) |

## Two open decisions (yours, not blockers)

1. **Upgrade-discount daylight.** Default is 6% of $200k = exactly $12,000, which numerically equals the Tier 1
   price. Both pricing docs note that for maximum distance from any "return of capital" reading, counsel may
   prefer `FOUNDING_UPGRADE_DISCOUNT_PCT` set so its dollar result is **not** exactly $12,000. Decision pending.
2. **Which credit product (if any) to unlock first**, and by which path — e.g. the `self_financed`
   four-installment flex-pay (one-time attorney read) vs a licensed provider. All three stay "coming soon"
   until you decide with your lawyer.
