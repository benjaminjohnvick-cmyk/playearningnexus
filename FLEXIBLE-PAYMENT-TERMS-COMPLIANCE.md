# Flexible Payment Terms — Compliance Write-up (CREDIT — OFF by default)

> **⭐ The compliant "pay over time" option is the no-debt self-paced model** (`TIER1-SELF-PACED-NO-DEBT.md`):
> pay-as-you-go, benefits proportional to what's paid, nothing owed — not credit, so it's ON with no gate.
> This installment-credit product stays OFF and counsel-gated; the concierge now leads with the self-paced
> option and only surfaces this plan if/when it's licensed and switched on.

**Prepared for consumer-/commercial-finance + FTC counsel. Not legal advice.** Nothing here may originate a
plan until counsel has reviewed the installment program, disclosures, and licensing.

## What it is

A **last-resort downsell**: when a customer has declined the other options in the concierge chat, the AI may
offer to **split a product's price into installments** — default **4 equal payments, one every 3 months, paid
off within 12 months** (a "pay a fourth each quarter" plan). **Payment is by credit card only** — four
scheduled card charges a year; **customers do NOT pay from earnings.** Optionally, and only if the customer
separately opts in, they may choose to move up to the next tier later if results are strong.

## What was deliberately changed from the original ask (and why)

The owner's original description had two elements that would have created real legal exposure. They were
reshaped, not dropped:

1. **"Agreeing to the next-tier upsell as a *condition* of the payment terms" → made OPTIONAL / opt-in.**
   Conditioning credit (or a payment plan) on the customer agreeing to a **future purchase** — especially a
   $200,000 next tier — is a **tying arrangement** and an **unfair/deceptive practice (UDAAP)**, and at that
   size raises **unconscionability**. So the next-tier path is presented as an *optional benefit the customer
   may separately choose*, and it is **never a condition** of getting the terms. `FLEXPAY_NEXT_TIER_OPTIN`
   controls whether it's even offered; even when on, acceptance is affirmative and severable.

2. **Offering financing to "whoever refused everything" → kept as last-resort, but ability-to-repay is
   required.** Spreading a price into installments to help affordability is legitimate; but offering *credit*
   specifically at the moment someone has declined everything is exactly where regulators look for pressure
   and unsuitability. So `FLEXPAY_REQUIRE_ABILITY_TO_REPAY` is on and not to be disabled — no offer is made
   unless the customer can plausibly make the scheduled payments — and the disclosures make the "you can
   decline and just not buy" path explicit.

## Why it's gated off (it's credit)

Four scheduled payments with a balance owed is an **installment credit** product. The CFPB now treats
pay-in-4 as regulated credit, and these amounts ($12k Tier 1, up to $200k) are significant. So it is
**disabled by default** and cannot originate until, exactly like Tier 1 Financed:

- the `flexpay` flag is ON,
- `FLEXPAY_PROVIDER` != `none` (a licensed creditor of record), and
- `FLEXPAY_LEGAL_SIGNOFF` = true (counsel approved).

`flexPayAccept` refuses with `program_not_live` until all three hold. The scaffold **never moves money** — a
licensed creditor originates, services, bills, and collects under counsel-approved terms. No lockout, no
backup-card charge, no in-app collections.

### "Can we run this without a third-party lender?" — the self-financed path

Because payment is by **credit card** in **four or fewer, 0% installments**, you may be able to **self-finance**
the plan (no BNPL/bank lender) under the **four-installment exemption** — the merchant lets the buyer pay over
≤4 installments with no finance charge, running the charges through its normal card processor. The provider
setting now includes **`self_financed`** for exactly this.

This is **not** a green light to turn it on. "Paid by credit card" does not remove the credit — the *deferral*
of payment is the credit — so the counsel gate stays. Whether the four-installment exemption actually applies
is a legal determination that depends on: your **states**, whether buyers are **consumers or businesses**, the
**amounts** ($12k–$200k is significant), the CFPB's tightening treatment of **pay-in-4**, and getting the
**recurring-card authorization** right (card-network + Reg E rules). So `self_financed` **still requires
`FLEXPAY_LEGAL_SIGNOFF = true`** — a lawyer's confirmation, not a lender's. Once counsel confirms, you can go
live self-financed with no outside provider.

## Open items for counsel

- **Licensing / disclosures** for installment credit in the jurisdictions you'll offer it (TILA/Reg Z for
  consumers; state retail-installment and commercial-financing disclosure laws; who the borrower is —
  business vs individual/sole-prop changes the regime).
- **Payment method**: installments are paid by **credit card only** (scheduled card charges) — customers do
  **not** pay from earnings, so the closed-loop-scrip-against-a-debt / money-transmission question does not
  arise here. Confirm the recurring-card authorization language meets card-network + Reg E/Reg Z rules.
- **The last-resort trigger**: confirm the presentation isn't high-pressure; the current copy is low-key,
  dismissible, and leads with "you can decline and just not buy."

## Where it lives in code

- Flag: `flexpay` (OFF). Settings category "Flexible Payment (credit — OFF)": `FLEXPAY_INSTALLMENTS` (4),
  `FLEXPAY_INTERVAL_MONTHS` (3), `FLEXPAY_TERM_MONTHS` (12), `FLEXPAY_APR_PCT` (0), `FLEXPAY_LAST_RESORT_ONLY`,
  `FLEXPAY_REQUIRE_ABILITY_TO_REPAY`, `FLEXPAY_NEXT_TIER_OPTIN`, `FLEXPAY_PAYMENT_METHOD` (credit_card),
  `FLEXPAY_RECOURSE`, `FLEXPAY_PROVIDER`, `FLEXPAY_LEGAL_SIGNOFF`.
- Model: `backend/sdk/flexpay.ts` — gate, `buildFlexPlan` (installment schedule), `assessFlexPayOffer`,
  `flexPayDisclosures`.
- Entity: `FlexPayPlan` (owner-scoped) — schema + rls.
- Functions: `flexPayOffer` (read-only, gated + last-resort + ATR), `flexPayAccept` (hard-gated origination,
  optional opt-ins only, never moves money).
- UI: the concierge widget shows "None of these work for you?" only after a recommendation the customer
  didn't take; it surfaces the plan + disclosures if the program is live, otherwise "not available yet."
