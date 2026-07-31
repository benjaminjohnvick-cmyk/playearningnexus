# Revenue Streams — business-funded, never a customer markup

**Prepared 2026-07-30.** The design goal: **customers pay wholesale + a discount, never a markup.** Every
dollar the platform earns comes from **businesses** (advertisers, sellers, sponsors, brands, developers,
financing partners) or from **structural margin** (breakage, negotiated spreads). All of it is written to
one ledger — **`RevenueEvent`** via `recordRevenue()` (`backend/sdk/revenue.ts`) — which carries the
invariant `customer_paid: false`. The admin `revenueReport` proves that invariant (expects
`customer_paid_usd = 0`).

The advertiser AdGrid alone (~$3,540 margin per matched user/year) already out-earns the retired markup
(~$146/user/year) by ~24×, so dropping the customer markup is affordable many times over — the constraint
is advertiser supply, not money.

## What's wired

Businesses interact through the new **`BusinessPortal`** page (sign up, subscribe, buy placement, book a
panel). Functions: `businessSignup`, `businessSubscribe`, `buySponsoredPlacement`, `createAudiencePanel`,
`revenueReport`. Entities: `RevenueEvent`, `BusinessAccount`, `BusinessSubscription`, `SponsoredPlacement`.
All fees live in the **Revenue** settings category (safe `0`/off defaults — nothing bills until you price
it).

## The streams (owner-selected set)

### Option A — recover the margin from businesses

| # | Stream | How it's implemented | Owner action |
|---|---|---|---|
| A1 | **AdGrid funds all discounts** | `ADGRID_FUNDS_ALL_DISCOUNTS` flag + `adgridFundsAllDiscounts()` — routes the advertiser/loyalty pool to fund the discount for *every* user (extends the loyalty engine you already have). | Turn on; sign advertisers to grow the pool. |
| A2 | **Seller-side commission** | `splitSellerProceeds()` + `MARKETPLACE_SELLER_COMMISSION_PCT` (0.10) — takes the platform cut from the **seller's** proceeds, never the buyer. Records `seller_commission`. | Wire `splitSellerProceeds` into the marketplace sale/settlement (one line where seller funds release). |
| A3 | **Sponsored placement** | `buySponsoredPlacement` + `SponsoredPlacement` entity + `SPONSORED_PLACEMENT_PRICE_USD`. Customer prices unchanged. | Set a price; (optionally) boost sort for active placements. |
| A4 | **Below-wholesale sourcing** | `recordRevenue({type:"sourcing_margin"})` hook. The spread between wholesale and retail is margin. | Negotiate wholesale; log the margin per fulfilled order. |
| A5 | **Affiliate commissions** | Existing affiliate listings; log via `recordRevenue({type:"affiliate_commission"})`. | Grow affiliate catalog (already supported). |
| A6 | **Business sign-up / onboarding fee** | `businessSignup` + `BUSINESS_SIGNUP_FEE_USD` / `BUSINESS_ONBOARDING_FEE_USD`. | Set the fee. |
| A7 | **B2B SaaS tiers** | `businessSubscribe` + `BusinessSubscription` + `BUSINESS_SAAS_BASIC/PRO/ENTERPRISE_USD` (49/299/999). | Set tier prices; recurring billing job when the processor is live. |
| A10 | **Lead / referral fee** | `computeLeadFee()` + `LEAD_REFERRAL_FEE_USD` / `_PCT`; record `lead_fee` when the platform sends a business a customer. | Set the fee; call `recordRevenue` from the affiliate/referral/booking flow. |
| A11 | **Co-op marketing funds** | `recordRevenue({type:"coop_fund"})`; brand dollars used *as the customer discount*. | Sign co-op deals; apply funds to the discount pool. |
| A12 | **Payment-processing rebate** | `processingRebatePct()` + `PROCESSING_REBATE_PCT`; record `processing_rebate` on volume. | Negotiate the processor rebate; then set the %. |

### Option B — other non-customer revenue

| # | Stream | How it's implemented | Owner action |
|---|---|---|---|
| B13 | **Advertising** | `buySponsoredPlacement` with a `slot` → records `advertising`. | Define ad slots + price. |
| B14 | **Breakage** | `revenueReport` estimates it: outstanding closed-loop points × `BREAKAGE_RECOGNITION_PCT` (0.15). Reporting-only. | Review the estimate; recognize per your accounting. |
| B15 | **Sponsored jackpots/tournaments** | `recordRevenue({type:"sponsored_prize"})`; a brand funds the prize pool for exposure. | Add a sponsor to a prize pool; log the sponsorship. |
| B16 | **Developer/creator cut** | `devCreatorCutPct()` + `DEV_CREATOR_PLATFORM_CUT_PCT` (0.20); record `dev_creator_cut`. | Wire into the dev/creator payout (apply the cut, log it). |
| B17 | **White-label / API licensing** | `recordRevenue({type:"white_label"})`; existing `APIAccessKey`. | Close licensing deals; log the fee. |
| B18 | **BNPL merchant fee** | **Wired** in `affirmConfirm` — records `bnpl_merchant_fee` = order × `BNPL_MERCHANT_FEE_PCT`. | Set the % your BNPL partner pays. |
| B19 | **Premium membership fee** | Existing $1/day-from-earnings (`membershipDailyFee`). | None — already live. |
| B20 | **Gift-card / catalog arbitrage** | `recordRevenue({type:"arbitrage_margin"})`; buy below face, redeem at face. | Source bulk; log the spread. |
| B22 | **Shipping spread** | `recordRevenue({type:"shipping_margin"})`; negotiated rate below what's passed through. | Negotiate carrier rates; log the spread (keep it honest). |
| B23 | **Audience panels / segments** | `createAudiencePanel` + `SponsoredPlacement(slot:"audience_panel")` + `AUDIENCE_PANEL_PRICE_USD`. | Set a price; deliver **aggregate, consented** insights only. |

## The closed-loop margin model (seller keeps 100% + cash-back)

The default marketplace mode is now **`cashback`** (`MARKETPLACE_MARGIN_SOURCE`): the member seller keeps
**100%** of their sale **and** gets **10% back in non-cashable points** (`SELLER_CASHBACK_POINTS_PCT`), and
the **buyer pays no markup**. The platform's 10% is not taken from anyone — it comes from the closed loop:

1. **Seller cash-back (Suggestion 1)** — issued as closed-loop points (nearly free scrip). Recorded as a
   **subsidy** (`recordSubsidy`, `kind:"subsidy"`), i.e. a cost, not revenue — so it never inflates the
   revenue total.
2. **Breakage is the real margin (Suggestion 2)** — `breakageReport` tracks outstanding vs redeemed points
   and recognizes the unredeemed portion (`BREAKAGE_RECOGNITION_PCT`) as retained value. This is where the
   "10%" actually lands: value of points that are never redeemed, paid by no one.
3. **Catalog sourcing spread (Suggestion 3)** — when a platform-catalog item is bought with points, the
   spread between the points' face value and the wholesale cost (`wholesale_cost_usd`, or
   `CATALOG_WHOLESALE_FRACTION`) is booked as `sourcing_margin` revenue — funded by the cash the buyer
   already earned.
4. **Advertiser pool backstop (Suggestion 4)** — `breakageReport` proves breakage **+** the advertiser pool
   (`pooledAnnualRevenueUsd`) **cover** the cash-back subsidies (`coverage()` → `seller_cashback_is_free`),
   so the perk is genuinely funded, not magic.

The one door kept shut: **no owner-side points→cash conversion.** Points stay non-cashable/closed-loop —
that's the money-transmission shield. The platform's real money is the survey/advertiser cash and the
breakage, which are already the platform's; it never needs to launder value back through points.

Modes: set `MARKETPLACE_MARGIN_SOURCE` to `seller` (commission from the seller, A2) or `off` (seller keeps
100%, no cash-back) if you prefer. `revenueReport` now splits `recorded_revenue_usd` from `subsidies_usd`
and shows `net_after_subsidies_usd`.

## Compliance notes

- **Never a customer markup** is the invariant — `revenueReport.customer_paid_usd` must stay `0`.
- **Data products (A5-adjacent, B23)**: any insight sold to a business must be **aggregate + anonymized +
  consented** (your Privacy Policy + counsel). Never sell individual-level data.
- **Breakage (B14)** is a reporting estimate, not a cash booking — recognize per your accountant.
- Avoid **float/interest on held balances** — that's a money-transmission trap (not implemented here).
- **Membership + AdGrid** language must keep FTC-clean disclosure (already reviewed in the lawyer packet).

## Where to grow next (documented one-liners, not yet wired into money flows)

A2 seller commission and B16 dev/creator cut ship as **helpers + settings + ledger hooks** so they don't
touch the live payment/payout paths until reviewed. Wiring each is a one-line `recordRevenue()` +
`splitSellerProceeds()`/`devCreatorCutPct()` call at the point where seller funds release / creator payouts
run — say the word and I'll wire them into those specific flows with a verification pass.
