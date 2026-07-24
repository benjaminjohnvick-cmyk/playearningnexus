# Payments Test Checklist — sandbox → live

The money paths are where a developer's hours balloon (10–15h) because they test blind. This script
makes it mechanical: exact test cards, exact expected results, exact order. Target: **~8–10h**.

> The economy is **closed-loop**: regular users buy/earn **store credit**; only **partners/affiliates**
> receive **cash payouts**. There's a single **10% markup** charged once when a user orders an item.
> Keep that model in mind while testing.

## Phase 1 — Stripe in TEST mode
Use Stripe test keys (`sk_test_…` / `pk_test_…`) first.

| # | Action | Test card | Expected result |
|---|---|---|---|
| 1 | Buy store credit (card) | `4242 4242 4242 4242`, any future exp, any CVC | Credit added 1:1 to balance; Stripe dashboard shows a test charge |
| 2 | Buy store credit — decline | `4000 0000 0000 0002` | Graceful "payment failed"; **no** credit added |
| 3 | 3-D Secure card | `4000 0027 6000 3184` | Prompts authentication; completes on approve |
| 4 | Order an item with store credit | — | Balance drops by item price **+10% markup**; Order created with `pending_ai_fulfillment` |
| 5 | Order an item — insufficient credit | — | Blocked with "insufficient store credit"; no order |

## Phase 2 — PayPal in SANDBOX
Use PayPal sandbox client id/secret + a sandbox buyer account.

| # | Action | Expected result |
|---|---|---|
| 6 | Buy store credit via PayPal | Sandbox approval flow → credit added; capture recorded |
| 7 | Partner **cash payout** request (PayPal) | Goes into the **oversight/approval queue** (not paid instantly) |
| 8 | Approve the payout in the admin queue | Payout executes in sandbox; status → paid; user sees confirmation |
| 9 | Regular user tries to request **cash** | Blocked — regular users get store credit, not cash (closed-loop rule) |

## Phase 3 — Markup & economy integrity
| # | Check | Expected |
|---|---|---|
| 10 | Order total math | `charge = item_price × 1.10`, applied **once** (not stacked on buy-credit) |
| 11 | Business/partner account orders | **No** markup (raw price) |
| 12 | Tamper test: try to set balance from the browser console/devtools | Server rejects — economy fields are server-authoritative |

## Phase 4 — Go LIVE (only after Phases 1–3 pass)
1. Swap Stripe test keys → **live** keys (`sk_live_…`, `pk_live_…`); same for PayPal **live** credentials.
2. Do **one real small charge** end-to-end (buy $1–5 of credit), confirm it appears in the live dashboard,
   then refund it.
3. Do **one real partner payout** of a small amount through the approval queue; confirm receipt.
4. Turn on webhook verification (`PAYOUT_WEBHOOK_SECRET`) and confirm a webhook is received & validated.

## Sign-off
- [ ] All test-mode rows pass · [ ] One real live charge + refund verified · [ ] One real payout verified
- [ ] Markup applied exactly once · [ ] Balance cannot be tampered client-side
