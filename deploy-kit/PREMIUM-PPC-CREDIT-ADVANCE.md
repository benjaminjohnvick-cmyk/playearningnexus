# Premium PPC — In-Store-Credit Advance Engine

Built into the backend. Charges are **off by default** (test mode) and gate behind one env flag.

> ⚠️ **Legal/compliance is not handled by this code.** This feature extends money to consumers and
> charges their cards — functionally a consumer cash-advance/credit product. Before flipping it live,
> confirm with a consumer-finance attorney **and** your payment processor (Stripe and the card
> networks restrict cash advances/lending). `PREMIUM_PPC_LIVE_CHARGES` is an operational safety catch
> to protect your Stripe account — it is **not** a compliance sign-off.

## The model (per matched advertiser ⇄ user pair)

- An advertiser pays **$5,000/year** for the Premium PPC AdGrid (`PPC_GRID_ANNUAL_PRICE`).
- Premium PPC users are matched **1:1** to advertisers — *N paying advertisers ⇒ at most N premium users.*
- A matched user receives a **fixed $1,460** advance as in-store credit. **You keep the rest ($3,540).**
- The user repays the $1,460 by staying active. On any day they earn **less than $8**, their card is
  charged **$8**, until the $1,460 is repaid.
- Of each $8 charged: the business gets **$4 as store credit** (the "50% refund" = half of the $8),
  and the platform keeps the other **$4**.
- On top of that, the business gets **$32/day in free social-media advertising credit** — until they
  have **doubled their investment**, i.e. received **$10,000 in fulfilled product/service orders**
  (`PREMIUM_DOUBLING_MULTIPLE` × grid). After $10,000 in orders, free social credit stops.

### Refund + order fulfillment
- The business's refund is **store credit** on `refund_credit_balance`, not cash.
- **Businesses and customers** spend refund credit (and in-store credit) on **products and online
  services** via AI order fulfillment — AI fills the order automatically.
- **No 10% markup** is ever charged on refund-credit payments (for anyone). See `REFUND-POLICY.md`.

### Worked example
User takes the $1,460 advance, then misses 10 days:
- Card charged **10 × $8 = $80**. Business gets **10 × $4 = $40** store credit; you keep **$40**.
- Business also gets **10 × $32 = $320** social credit (while under the $10,000 doubling target).
- User keeps missing days until the $1,460 is repaid (~183 missed days), then charging stops.

## Pieces (all in the repo)

| Piece | File |
|---|---|
| Config + off-session card charger (gated) | `backend/sdk/premium-ppc.ts` |
| Enroll (1:1 match + card-on-file + consent) | `backend/functions/premiumPPCEnroll/entry.ts` |
| Request advance ($1,460 store credit) | `backend/functions/premiumPPCRequestAdvance/entry.ts` |
| Daily reconcile (charge + refund + social) | `backend/functions/premiumPPCDailyReconcile/entry.ts` |
| Status + slot availability | `backend/functions/premiumPPCStatus/entry.ts` |
| Order fulfillment (refund credit, services, no markup) | `backend/functions/placeStoreOrder/entry.ts` |
| Refund policy | `deploy-kit/REFUND-POLICY.md` |
| Ledger tables | `PremiumPPCMembership`, `PremiumPPCCharge` |
| Daily cron (08:00 UTC) | `backend/scheduler/schedules.json` → `daily-premium-ppc-reconcile` |
| Enrollment UI | `src/pages/UpfrontEarningsPage.jsx` + `src/components/premium/PremiumPPCEnrollModal.jsx` |

## Env (see `backend/.env.example`)

```
PREMIUM_PPC_LIVE_CHARGES=0        # 0 = test (simulate, no card touched) · 1 = live charges
PPC_GRID_ANNUAL_PRICE=5000
PREMIUM_ADVANCE_AMOUNT=1460       # fixed advance; platform keeps $3,540
PREMIUM_DAILY_MIN_EARN=8
PREMIUM_MISSED_DAY_CHARGE=8
PREMIUM_BUSINESS_REFUND_PER_DAY=4 # business store credit / day ($4 of the $8; platform keeps $4)
PREMIUM_SOCIAL_CREDIT_PER_DAY=32  # social-media ad credit / day (until doubled)
PREMIUM_DOUBLING_MULTIPLE=2       # ads/social stop after business receives $10,000 in orders
```

## Doubling tracker
`placeStoreOrder` increments the advertiser's `ppc_orders_value_delivered` whenever an order is placed
for their product/service (`product.advertiser_user_id`). The daily reconcile stops granting social
credit once that reaches $10,000. Wire your order/checkout paths to set `advertiser_user_id` on the
product so attribution is captured.

## Testing safely
Leave `PREMIUM_PPC_LIVE_CHARGES=0`. Enroll → request advance → run `premiumPPCDailyReconcile` (or the
cron). Missed days record **simulated** $8 charges and update every ledger (business +$4 store credit,
+$32 social, platform +$4) with **no card touched**. Flip to `1` only after legal + processor sign-off.
