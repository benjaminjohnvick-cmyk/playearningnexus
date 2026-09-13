# Global Launch Legal Strategy Brief — Get Goods Gratis (Free)

> **⚠️ DRAFT — NOT LEGAL ADVICE.** An inventor-prepared strategy brief for discussion with counsel: how to
> structure the legal work for a **multi-country launch through a single lead attorney**, what can be centralized
> vs. what needs local review, and a phased market plan. It is a **map of how the process is usually structured**,
> not legal advice — counsel confirms the specifics. Bracketed items **[LIKE THIS]** are decisions for
> counsel/owner. Prepared 2026-09-13.

---

## 0. The question this answers

*"Can I prepare a global launch — as many countries as possible — working with one attorney, or do I need a
different attorney in every country?"* **Short answer: one lead attorney, not fifty.** You retain a single lead
firm that handles everything centralizable and quarterbacks local specialists only where a specific market
requires it. This brief lays out that model and a phased plan so "global" is tractable and affordable.

---

## 1. The engagement model — hub and spoke

- **One lead firm (the hub).** Your primary counsel coordinates the whole effort, handles all centralizable work
  (§3), and is your single point of contact.
- **Local counsel (the spokes), engaged as needed.** When a market needs a local specialist (e.g., promotions
  law, data registration, payments), the **lead firm engages and manages them** — often through its own
  international network, a formal law-firm alliance, or referral relationships — so you keep one relationship.
- **The decisive question to ask any prospective lead firm:** *"Do you have an international network, or can you
  quarterback local counsel in my target markets?"* That one answer tells you whether a firm can serve a global
  launch. **[Owner: ask this of every firm you interview.]**

## 2. The foundation you already have — "strictest standard, applied worldwide"

The platform is already built to adopt the **strictest** applicable rule and apply it to everyone, rather than
geo-detecting the minimum per user (see `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`,
`GLOBAL-COMPLIANCE-AND-LOCALIZATION.md`). This is exactly the right posture for going global cheaply: **one
compliant product clears many regimes at once**, so most legal work is done once at the framework level and only
a thin layer is country-specific. Protecting this posture is the first instruction to give counsel.

## 3. Centralize vs. localize — the split that sizes the work

| Centralizable — done once, covers everywhere (lead firm) | Country-specific — needs local input, market by market |
|---|---|
| Corporate/entity structure and the IP-holding entity | **Promotions / sweepstakes law** — varies wildly; some countries restrict or ban prize competitions (per-market) |
| The full contract stack: ToS, EULA, Privacy framework, Partner Agreement, Advertiser Agreement, AUP | **Consumer-protection** specifics (distance selling, cancellation/withdrawal rights, warranties) |
| US federal + state law analysis | **VAT/GST registration** and invoicing rules |
| **Trademark** via the **Madrid Protocol** (one filing → many countries) | **Data-protection representatives** (GDPR Art. 27 EU rep; UK rep) and any local registration |
| **Patent** via the **PCT** (one international filing preserves rights ~150 countries) | **Payments / e-money / money-transmission licensing** (the big per-jurisdiction landmine — §4) |
| Privacy framework at the GDPR high-water mark (§6) | **Language/localization** of legal terms and consumer disclosures |
| AI-content disclosure / C2PA posture | **Advertising law** specifics and any **age/gambling-adjacency** rules |

The table is the whole point: the **left column is most of the work and it's done once**; the right column is a
thin, market-by-market layer you add as you expand.

## 4. The closed-loop design is your licensing firewall — preserve it

**Money-transmission and e-money licensing is the single biggest per-country landmine** for a platform like this.
Your **closed-loop, non-cashable** consumer credit (Site Cash) — with real money flowing only to
businesses/partners — is precisely what keeps you out of most of that licensing in most jurisdictions. Every
market-entry decision should start by confirming the closed loop holds there. This ties directly to
`TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md` and `PAYMENTS-ARCHITECTURE-AND-MERCHANT-BRIEF.md`. **[Counsel:
confirm the closed-loop posture keeps the platform outside money-transmitter/e-money regimes per target
market; flag any market where stored-value/prepaid rules still attach.]**

## 5. Globalizing the IP (the two mechanisms that do the heavy lifting)

- **Trademark — Madrid Protocol.** File once (building on a home/base application) and extend protection to any
  of ~130 member countries by designating them, through one centralized system, instead of separate national
  filings. **[Counsel: base application + the initial country designations to file.]** See
  `TRADEMARK-FILING-BRIEF.md`.
- **Patent — PCT (Patent Cooperation Treaty).** One international application preserves your filing date across
  ~150 countries and defers the expensive national-phase decisions for up to **30 months** — buying time to see
  where the product actually gains traction before committing. **[Counsel/patent attorney: file the provisional
  first (already drafted), then the PCT within the priority year.]** See `PROVISIONAL-PATENT-APPLICATION-DRAFT.md`.

## 6. Globalizing privacy — GDPR as the high-water mark

Build to **GDPR/UK GDPR** (the strictest mainstream regime) and most others fall below it. Instead of counsel in
every country, the specific appointments are: an **EU representative** and a **UK representative** (GDPR/UK GDPR
Art. 27) where required, plus a lawful **international-transfer mechanism** (e.g., standard contractual clauses).
This rides on the data map you already have (`DATA-COLLECTION-BRIEF-FOR-COUNSEL.md`). **[Counsel: confirm
representative appointments and transfer mechanism for the launch markets.]**

## 7. Globalizing tax — one framework for the bloc, a specialist for the rest

Tax is a **CPA/international-tax-advisor** job run in parallel with counsel, not a per-country lawyer task. The
EU's **VAT OSS/IOSS** lets you register once for cross-border EU digital-sales VAT; **marketplace-facilitator**
rules and economic-nexus thresholds are handled market-by-market by the tax advisor. See
`TAX-OBLIGATIONS-AND-FILINGS-BRIEF.md`. **[Owner: engage an international-tax advisor with multi-country reach,
e.g., a Big-4 or specialist, alongside the lead law firm.]**

## 8. Phased market plan — launch in tiers, not everywhere at once

Launching in three well-cleared markets beats launching in forty half-cleared ones. Suggested sequence:

- **Tier A — home + low-friction English markets:** United States first, then **Canada, United Kingdom,
  Australia**. Lowest legal friction, shared language, strong IP systems.
- **Tier B — the EU/EEA as a single bloc:** GDPR + the **European Accessibility Act** + VAT **OSS** cover 27+
  countries under one framework and one set of registrations. Add the Art. 27 EU representative.
- **Tier C — targeted expansion:** further markets added as revenue justifies local counsel, prioritized by
  market size and legal friction.
- **Geo-restrict at launch:** markets where the prize competition, closed-loop credit, data-localization, or
  unusual promotion/consumer rules create real friction (e.g., China and certain others) — restrict now,
  revisit later. **[Counsel: confirm the restrict list.]**

## 9. Per-market triage — ask counsel to sort every target market into three buckets

1. **Clear with the baseline** — the strictest-standard build already satisfies it; launch.
2. **Needs local review** — one discrete local-counsel question (usually promotions, payments, or consumer law)
   before launch.
3. **Geo-restrict for now** — defer until the product and revenue justify the work.

This triage is the single most useful deliverable to request from the lead firm — it converts "as many countries
as possible" into a concrete, prioritized, costed list.

## 10. The high-risk surfaces to clear in each market

Across jurisdictions, the recurring pressure points for this specific product are: the **prize competition**
(sweepstakes/lottery/gambling lines — the most jurisdiction-variable), the **closed-loop credit** (money/e-money
lines — §4), the **earn-to-shop / rewards** model (consumer-protection and "is it a financial product"
characterization), **data collection** (§6), **age assurance** (18+ beyond self-attestation, especially with the
social/voice feature), and **advertising claims** (truth-in-advertising and the no-results-guarantee posture).
Each is already documented in the packet; the global question is simply *which markets need a local look at each.*

## 11. How to work with the attorney — the engagement checklist

Bring the lead firm your organized packet and ask them to:

1. **Confirm the strictest-standard baseline** holds as the global foundation (§2).
2. **Run the per-market triage** (§9) over your target list — clear / local-review / geo-restrict.
3. **Preserve and pressure-test the closed-loop firewall** per market (§4).
4. **Set up the IP filings** — provisional → PCT for patent; Madrid for trademark (§5).
5. **Handle the privacy appointments** — EU/UK representatives + transfer mechanism (§6).
6. **Coordinate with an international-tax advisor** for VAT OSS + marketplace-facilitator/nexus (§7).
7. **Confirm they can quarterback local counsel** in the Tier A/B markets (§1).
8. **Sequence the rollout** and the geo-restrict list (§8).

## 12. Questions to finalize (for counsel)

1. Lead-firm **international network / local-counsel quarterbacking** capacity (§1).
2. **Target-market triage** — clear / local-review / geo-restrict (§9).
3. **Closed-loop firewall** per market — any stored-value/e-money attachment (§4).
4. **IP filing plan + timing** — provisional/PCT and Madrid designations (§5).
5. **Privacy representatives + transfer mechanism** for launch markets (§6).
6. **International tax** engagement + VAT OSS registration (§7).
7. **Prize-competition** legality per market (§10) — the highest-variance item.
8. **Age-assurance** standard per market given the social/voice feature (§10).
9. **Rollout sequence + geo-restrict list** sign-off (§8).
10. Whether to launch US-only first and expand, vs. Tier A simultaneously (§8).

*This is a draft strategy brief, not legal advice, and is not a substitute for engagement with a licensed
attorney (and an international-tax advisor). Related: `STRICTEST-STANDARD-COMPLIANCE-POLICY.md`,
`GLOBAL-COMPLIANCE-AND-LOCALIZATION.md`, `DATA-COLLECTION-BRIEF-FOR-COUNSEL.md`,
`TAX-OBLIGATIONS-AND-FILINGS-BRIEF.md`, `TRADEMARK-FILING-BRIEF.md`, `PROVISIONAL-PATENT-APPLICATION-DRAFT.md`,
`TREASURY-SOLVENCY-AND-PAYPAL-SETTLEMENT.md`, `FOR-YOUR-ATTORNEY.md`.*
