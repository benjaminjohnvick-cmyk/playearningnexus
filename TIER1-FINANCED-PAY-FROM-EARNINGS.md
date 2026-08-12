# Tier 1 Financed — "Pay From Earnings" (RECOURSE credit — OFF by default)

**Prepared for review by qualified consumer-/commercial-finance + FTC counsel. This is NOT legal advice.**
Nothing in this program may launch, and no plan may be originated, until counsel has reviewed the full
recourse structure, the disclosures, the earnings-sweep authorization, and the licensing posture.

## What the owner asked for

A new way to take the **Tier 1** advertising package: instead of paying **$12,000 upfront**, the advertiser
takes it with **$0 down**, uses the app for a year, and the site **automatically sweeps their in-app
earnings toward the $12,000** over the term. **At the end of the year, any remaining balance is DUE** — the
advertiser chose the version where the **$12,000 is owed regardless of how much they earn**.

## Why this is treated as regulated credit (and is disabled by default)

This is fundamentally different from the platform's other "pay from earnings" mechanics:

- The **free earn-to-unlock tier** and the **non-recourse revenue-share** never create a debt — if earnings
  fall short, nothing is owed. Those are safe to run.
- **This** program creates a **fixed $12,000 obligation** that survives a shortfall. A fixed amount owed,
  repaid over time, is **credit** — and because the borrower remains liable for any shortfall, it is
  **recourse** credit. That is heavier than the non-recourse Goods Advance and squarely a regulated lending /
  commercial-financing product.

Consequences that counsel must resolve **before** this is enabled:

1. **Creditor of record + licensing.** A licensed creditor must originate it (partner bank, or the platform
   holding the required state lending / commercial-financing / retail-installment licenses). `none` keeps it
   off.
2. **Disclosures.** Recourse credit carries disclosure obligations (e.g. TILA-style for consumers; state
   commercial-financing disclosure laws such as CA/NY/others for business borrowers). Amount financed, any
   finance charge, the term, and what is owed at term end must be disclosed clearly and accepted.
3. **Who the borrower is.** Tier 1 "advertisers" who are individuals or sole proprietors can pull this into
   **consumer** credit law. Counsel must define eligibility (true businesses only?) and the resulting regime.
4. **The earnings-sweep + closed-loop question.** In-app earnings are **closed-loop, non-cashable Site Cash**.
   Applying that scrip to satisfy a real **$12,000 cash debt** effectively gives it cash-equivalent value,
   which can undercut the non-cashable/closed-loop **money-transmission shield**. Counsel must decide whether
   the sweep is applied as store credit against the advertising fee (not cash), and how that is characterized.
5. **Collections at term end.** Any billing or collection of a shortfall is performed by the **creditor of
   record under counsel-approved terms** — this app wires **no** lockout, **no** backup-card charge, and
   **no** in-app collections. (Those remain prohibited by our standing compliance rules.)

## How the code enforces "off until approved"

Mirrors the Goods Advance gate. Origination (`tier1FinancedAccept`) refuses with `program_not_live` unless
**all three** are true:

- feature flag `tier1_financed` = ON (default **OFF**),
- `TIER1_FINANCED_PROVIDER` != `none` (a licensed creditor configured), and
- `TIER1_FINANCED_LEGAL_SIGNOFF` = true (counsel approved).

Ability-to-repay is required and conservative: the offer is withheld unless the advertiser's **trailing earn
rate** could plausibly clear the full $12,000 from sweeps within the term — so we don't set someone up to owe
a cash shortfall. The scaffold **never moves money**; servicing/billing/settlement are the provider's.

### Settings (category "Tier 1 Financed (credit — OFF)")

| Key | Default | Meaning |
|---|---|---|
| `TIER1_FINANCED_PRINCIPAL_USD` | 12000 | The amount owed (the financed package price). |
| `TIER1_FINANCED_APR_PCT` | 0 | Finance charge. Non-zero adds disclosure duties. |
| `TIER1_FINANCED_TERM_MONTHS` | 12 | The year over which earnings are swept. |
| `TIER1_FINANCED_EARNINGS_SWEEP_PCT` | 1 | Fraction of earnings auto-applied (advertiser authorizes). |
| `TIER1_FINANCED_MIN_HISTORY_DAYS` | 60 | Ability-to-repay history gate. |
| `TIER1_FINANCED_REQUIRE_ABILITY_TO_REPAY` | true | Only offer if a year of sweeps could clear $12k. |
| `TIER1_FINANCED_RECOURSE` | true | The debt is owed; shortfall payable. Set false → non-recourse share. |
| `TIER1_FINANCED_PROVIDER` | none | Licensed creditor of record. Hard gate. |
| `TIER1_FINANCED_LEGAL_SIGNOFF` | false | Counsel approval. Hard gate. |

### Code

- Flag: `backend/sdk/feature-flags.ts` → `tier1_financed` (default false).
- Model: `backend/sdk/tier1-financed.ts` — config + gate, ability-to-repay eligibility, earnings-sweep
  projection, honest recourse disclosures.
- Entity: `Tier1FinancedPlan` (owner-scoped) — schema + rls added.
- Functions (all gated): `tier1FinancedEligibility`, `tier1FinancedTracker`, `tier1FinancedAccept`.
- Page: `/Tier1Financed` — shows "not available yet" by default; when live, shows the **debt** in red, the
  projected shortfall, and requires both a disclosure acceptance and an explicit earnings-sweep
  authorization.

## The safer alternative, kept one toggle away

Setting `TIER1_FINANCED_RECOURSE = false` converts this to a **non-recourse** earnings-share toward the
$12,000 — the site applies earnings, and if they fall short **nothing is owed**. That version is not regulated
credit and can run without the licensing above. If the recourse debt proves too heavy, this is the fallback
that keeps the "pay from earnings" experience without the lending exposure.
