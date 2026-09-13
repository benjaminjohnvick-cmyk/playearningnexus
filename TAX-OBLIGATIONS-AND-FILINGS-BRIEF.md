# Tax Obligations & Filings Brief — Get Goods Gratis (Free)

> **⚠️ DRAFT — NOT TAX OR LEGAL ADVICE.** This is an inventor-prepared orientation brief for a **licensed CPA /
> tax advisor** (and, where the law overlaps, counsel) to review, correct, and own. It maps the platform's
> **tax surface** — what is likely owed, filed, or collected, and by whom — so a professional can be briefed
> quickly. It does **not** decide any tax position. Bracketed items **[LIKE THIS]** are decisions for the
> tax pro / owner. Prepared 2026-09-13.

---

## 0. Orientation — the two halves of the tax surface

The platform's tax picture has two distinct halves, and they are handled by different mechanisms and different
professionals:

1. **Information reporting on money paid OUT** — the 1099 side. Real cash leaves the platform only to
   **business partners** (developers, affiliates, creators, advertisers as refund credit stays closed-loop).
   This is **already built and already documented** — see `TAX-1099-PIPELINE.md` (a copy sits in this folder)
   and `FOR-YOUR-ATTORNEY.md` §12. This brief does **not** re-do that work; it points to it and folds it into
   the whole tax picture.
2. **Transaction and entity taxes on the business itself** — sales/use tax and marketplace-facilitator
   collection, VAT/GST on cross-border digital sales, the operating entity's own income-tax returns, and
   digital-goods taxability. This half is **not yet consolidated anywhere** in the packet, and is the main
   reason this brief exists. It is primarily a **CPA / tax-advisor** function, with legal overlap on
   marketplace-facilitator and nexus law.

**The compliance spine still holds:** everyday users are **closed-loop** (non-cashable Site Cash) and generate
**no** payee tax reporting; real cash flows only to businesses/partners. That single fact shapes most of what
follows.

---

## 1. Information reporting — 1099 (already handled; here for completeness)

**Status: built and documented.** Business partners paid real cash run through a W-9 → backup-withholding →
1099-NEC pipeline: W-9 collection (`submitTaxInfo` → `TaxProfile`), per-payee annual reportable-payout tracking
from the money ledger, **24% backup withholding** (`TAX_BACKUP_WITHHOLDING_RATE`) auto-applied on every payout
rail when no W-9 is on file at/over the **$600** threshold (`TAX_1099_THRESHOLD`), a self-service Tax Center,
and a filing-ready 1099-NEC export (`tax1099Export`). Raw TINs are masked everywhere except an explicit
admin export for the filing provider. Full detail: `TAX-1099-PIPELINE.md`.

**For the tax pro to confirm** (also captured in `FOR-YOUR-ATTORNEY.md` §12):

- the $600 1099-NEC threshold and 24% backup-withholding rate/mechanics are correct for the actual facts;
- **1099-K exposure** if any payout rail (PayPal/Venmo/Cash App) is itself a third-party settlement organization
  that issues its own 1099-K — confirm there is no double-reporting and that the platform's role is correctly
  characterized on each rail; **[CPA to confirm per rail]**;
- which **filing provider** (e.g., Track1099) and any **state** 1099 filing / TIN-matching requirements;
- **TIN security** — the build masks and flags for provider hand-off; confirm encryption-at-rest or provider
  custody before real TINs are collected at scale.

---

## 2. Sales / use tax and marketplace-facilitator collection (the biggest open item)

The platform sells **goods** (and downloadable digital products/software/games as one searchable store category)
on a **zero-inventory** sourcing/fulfillment model. This raises the question that most consumer marketplaces
must answer:

- **Marketplace-facilitator laws.** In most U.S. states, a "marketplace facilitator" that lists third-party
  products and processes the buyer's payment is **required to collect and remit sales tax** on the marketplace's
  behalf, rather than each seller doing it. Whether the platform is a facilitator, a reseller/conduit, or a
  drop-ship retailer of record materially changes who collects. **[Tax pro + counsel to characterize the
  platform's role per the actual purchase/fulfillment flow.]**
- **Economic nexus.** Post-*Wayfair*, states assert sales-tax collection duties based on **sales volume /
  transaction thresholds** (commonly $100k or 200 transactions, but it varies by state), not physical presence.
  A national storefront can trip nexus in many states quickly. **[CPA to set a nexus-tracking and
  registration plan and pick a tax-calculation engine — e.g., a TaxJar/Avalara-class service — before scale.]**
- **Taxability of the actual items.** Physical goods, downloadable software, and digital games are taxed
  **differently** state to state (some states exempt digital goods, some tax SaaS, some don't). The zero-inventory
  drop-ship structure adds resale-certificate and exemption questions between the platform and its suppliers.
  **[CPA to map taxability by product category and state.]**
- **What is built today.** The platform does **not** currently compute or collect destination-based sales tax at
  checkout in a consolidated way (no marketplace-facilitator tax engine is wired in). **This is a genuine gap to
  close before real consumer sales scale**, and is the single most important item in this brief.
- **Closed-loop credit is not a sale of money.** Site Cash is non-cashable store credit, not a taxable
  transfer to the user; the taxable event is the **purchase of goods**, where credit and/or payment apply at
  checkout. **[CPA to confirm the credit-redemption mechanics don't create a separate taxable event.]**

---

## 3. VAT / GST and cross-border digital sales

If any digital product or software is sold to buyers **outside the U.S.**, consumption-tax regimes attach:

- **EU/UK VAT on digital services / e-services** — VAT is generally due in the **buyer's** country for B2C
  digital sales, often from the first sale (no small threshold for non-established sellers); the EU **OSS/IOSS**
  and the UK's own rules govern registration and remittance.
- **Other GST regimes** — Australia, Canada, and many others impose GST/registration duties on inbound digital
  sales above (or sometimes without) a threshold.
- **What is built today.** No VAT/GST calculation, registration, or OSS/IOSS handling is wired in. **[CPA /
  international tax advisor to scope which markets the store will actually sell into and whether to geo-restrict
  cross-border digital sales until VAT/GST handling is in place.]** Restricting international digital sales at
  launch is a reasonable way to defer this surface — a business/product decision to confirm.

---

## 4. The operating entity's own income tax

Separate from anything collected from customers:

- **Entity formation drives the filing.** Sole proprietor / single-member LLC (Schedule C), multi-member LLC
  (partnership return), S-corp, or C-corp each carry different federal + state income-tax returns and estimated
  quarterly payments. **[Owner + CPA to confirm the entity type — and keep it consistent with the licensor
  identity used in the EULA, Terms of Service, and the patent assignment.]**
- **Revenue recognition on prepaid advertising.** Advertiser tiers **prepay 52 weeks up front** recognized
  across 13 four-week cycles (`billing-schedule.ts`). Prepaid revenue recognized over a delivery period is an
  **accounting/tax timing** question (deferred revenue). **[CPA to set the revenue-recognition method.]**
- **Tax reserve / solvency.** The treasury model earmarks a tax set-aside within the solvency reserve
  (`TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`). **[CPA to confirm the reserve components and remittance
  cadence align with actual sales-tax and withholding obligations.]**

---

## 5. Recordkeeping the platform already produces (useful to the CPA)

The build already generates most of the primitives a tax pro needs, which lowers the cost of getting compliant:

- a **server-authoritative money ledger** (`MoneyLedgerEntry`) — every real-cash movement, with reportable-type
  tagging, is the source of truth for both 1099 box-1 figures and revenue;
- **per-payee annual aggregation** (`taxComplianceReport`) and a **filing-ready 1099-NEC export**
  (`tax1099Export`);
- **W-9 state + backup-withholding** recorded per payout (box 4);
- **advertiser billing records** (prepayment, 13-cycle recognition, cancellations/refunds as closed-loop credit).

What is **not** yet produced: a **sales-tax liability report by state/jurisdiction** and any **VAT/GST**
accounting. Those depend on first deciding the marketplace-facilitator characterization (§2) and the markets
served (§3).

---

## 6. Decisions to finalize (for the CPA / tax advisor, with counsel where noted)

1. **Marketplace-facilitator characterization** (§2) — is the platform a facilitator, reseller/conduit, or
   retailer of record? *(counsel + CPA)* — **this drives everything else in §2.**
2. **Sales-tax nexus + registration plan and a tax-calculation engine** (§2) — before consumer sales scale.
3. **Product-category taxability map** by state (§2) — goods vs. downloadable software vs. digital games.
4. **Resale/exemption handling** with zero-inventory suppliers (§2).
5. **Cross-border scope + VAT/GST** (§3) — which markets; whether to geo-restrict digital sales at launch.
6. **1099 items** (§1) — filing provider, state filing, 1099-K interplay per rail, TIN security at scale.
7. **Entity type + income-tax filings + estimated payments** (§4) — kept consistent with the EULA/ToS/patent
   licensor identity.
8. **Revenue recognition** on prepaid advertising (§4).
9. **Tax reserve components + remittance cadence** (§4).
10. **When to build the sales-tax engine** (§2/§5) — the largest engineering item this brief implies.

*This is a draft orientation brief, not tax or legal advice, and is not a substitute for review and sign-off by
a licensed CPA / tax advisor (and counsel where the law overlaps). Related: `TAX-1099-PIPELINE.md`,
`FOR-YOUR-ATTORNEY.md` §12, `PAYMENTS-ARCHITECTURE-AND-MERCHANT-BRIEF.md`,
`TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`.*
