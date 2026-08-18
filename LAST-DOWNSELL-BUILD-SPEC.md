# Last-Downsell Build Spec — "prepay & hold" + "pay from results"

*Everything needed to code the universal last-downsell ladder for advertisers, across tiers. This is the plan;
the open decisions at the bottom gate the actual build. Not legal advice.*

## The ladder (what we're building)

For any advertiser tier, the concierge offers a descending sequence when the buyer balks at paying upfront:

1. **Pay upfront** — normal purchase, best price (founding/upfront discount). *(Exists.)*
2. **Prepay & hold (deposit)** — pay now, funds captured and **held** (Stripe), refundable for anything
   undelivered, released to the platform over the hold window. Buyer commits but is protected. *(Partly exists
   for Tier 2; generalize + wire real Stripe capture-and-hold.)*
3. **Pay from results (non-recourse rev-share)** — advertise now, pay a **share of attributed results**,
   **owe nothing if there are no results**. Last resort; you carry the risk. *(Machinery largely exists in the
   free-tier rev-share; generalize as a downsell option.)*

## Reused vs new

**Reuse (already built):**
- `tier2-deposit.ts` (quote, earned-vs-unearned delivery status, make-good/refund) → generalize to all tiers.
- `earned-advertiser.ts` (`attributedSalesUsd`, `computeFreeAdvertiserRevenueShare`, tiered non-recourse
  rev-share 10%/5%) → the pay-from-results engine.
- Inventory governor (`inventory-governor.ts`) → rev-share advertisers get **residual / capacity-paced**
  inventory (served after paying + prepaid advertisers).
- AI funnel/concierge + suitability guard → routes the downsell ladder.
- Feature-flags + settings registry; consent ledger; scheduler (`schedules.json`).

**New:**
- `advertiser-downsell.ts` (SDK) — the three payment MODES, per-mode **eligibility**, the **decision engine**
  (`recommendPaymentOption(advertiser, tier, signals)` → ranked options + reasons), and pricing helpers.
- Generalized deposit: `advertiserDeposit` + `advertiserDepositStatus` endpoints (Tier 1 / founding / Tier 2),
  replacing the Tier-2-only ones (or wrapping them).
- **Stripe capture-and-hold** wiring: capture upfront → hold → auto-release at the hold window; refund/make-good
  path. (Real money movement — gated; see below.)
- Auto-release scheduled job (`schedules.json`): release matured holds, recompute earned/unearned, flag
  deposits past the refund window for alternate-refund handling.
- `payFromResults` enrollment + billing: enroll an advertiser non-recourse; bill the rev-share as attributed
  results accrue (inbound, as-you-go); residual-inventory priority.
- Concierge/`/Apply` integration: surface the ladder + eligibility; route a balking advertiser down it.
- Settings, flags, disclosures; `FOR-YOUR-ATTORNEY.md` items; a customer-facing terms doc for each mode.

## The decision engine (routing rules)

`recommendPaymentOption` runs deterministic branches (logged):

- **Attribution gate (hard):** can we measure this advertiser's results on-platform? **No → drop
  pay-from-results** (unbillable/disputable); offer upfront or deposit only.
- **Tier size:** large tiers (e.g. Tier 2) → **deposit, not rev-share** (too much service on spec).
- **Cash/assurance need + trust:** willing-but-cautious buyer → **deposit** (you keep the cash, they get
  protection). Won't commit any cash **and** attributable **and** small tier → **pay-from-results** (last resort).
- **Pricing gradient:** upfront cheapest (discount) → deposit same price, protected → **pay-from-results priced
  richer** (compensates your risk; keeps rev-share a true last resort, not the default).
- **Inventory:** pay-from-results seats are **capacity-paced / residual** via the governor.

## External dependencies (you provide)

- **Stripe live keys + merchant approval** for capture-and-hold (the deposit's real money movement).
- **Counsel sign-off** on the rev-share terms + attribution basis, and on holding customer prepayments (per
  your own compliance spine, rev-share and fund-holding are counsel-gated).
- **The rev-share rate / pricing numbers** (a business decision).

## Gating & compliance posture

Consistent with every money-movement/credit-adjacent feature in this project, the recommendation is to build it
now but ship **OFF behind a flag + provider/legal sign-off**, marketed "coming soon," and flip it live when
Stripe is approved and counsel clears the terms. Nothing originates or moves money until then.

## Open decisions (these gate the build — see the questions)

1. Which tiers get **pay-from-results** (the risky mode)?
2. Ship **gated OFF** behind flag + sign-off, or ON now?
3. Deposit **hold length** — 180 days (align to Stripe refund window) or 12 months?
4. Pay-from-results **pricing** — reuse the existing non-recourse 10%/5%, or set a richer, upfront-beating rate?
5. (Recommended defaults, override anytime) Attribution = **on-platform sales only**; rev-share inventory =
   **residual/capacity-paced**; surface in **both** the concierge and `/Apply`; build Stripe capture-and-hold now
   but keep it flag-gated until Stripe is live.
