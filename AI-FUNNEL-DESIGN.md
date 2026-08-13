# AI Concierge Funnel — Design & Guardrails

*One AI concierge across the whole catalog, with two decision gates. Reporting/recommendation layer — it
suggests and logs; it never charges (payment runs through the normal purchase flow). Not legal advice.*

## The shape: one concierge, two gates

- **Gate 1 — fit (before purchase).** A short conversation captures three signals — **goal** (grow / try /
  save), **capacity** (high / medium / low), **hesitation** (none / price / trust) — and the engine returns
  an **upsell / downsell / same** recommendation. Upsell when the bigger product genuinely fits; downsell
  when a smaller/free rung fits better or the customer is wavering (downsell is the anti-churn valve).
- **Commitment window.** Each product carries a required window (`window_days`) matched to how long its
  results take to show. During it the concierge coaches (use the thing) rather than sells.
- **Gate 2 — results (after the window).** The engine pulls the customer's **real result** on the product's
  metric and recommends **upsell** (strong), **downsell / right-size** (weak), or **hold + optimize**
  (middle). Strong results upsell *on proof*; weak results proactively right-size to retain the customer
  instead of losing them to a refund.

## Why the DECISION is deterministic (not an LLM)

The money-affecting choice — which product to recommend — is **rules + the customer's real numbers**, fully
explainable and logged to `FunnelJourney` for the AI-oversight feed. An LLM may phrase the reply in natural
language, but it never decides the offer. This is deliberate: an auditable, deterministic recommender is far
more defensible than an opaque model choosing what to sell, and it lets you tune behaviour with settings
instead of prompts.

## The product graph

`AI_FUNNEL_PRODUCT_GRAPH` (JSON, admin-editable) is a list of nodes; each has `key`, `name`, `price_usd`,
`up`, `down`, `window_days`, `metric` (`attributed_sales` | `earnings` | `engagement`), and `financial`.
`up`/`down` are the upsell/downsell edges, so "recommend up" is just "traverse the up edge." Default graph
covers both the **business path** (free no-upfront → sponsored placement → Tier 1 → Tier 2) and the
**consumer path** (free member → premium → points boost), plus the gated financial products.

## Gate 2 thresholds

- **Strong:** result ≥ `AI_FUNNEL_STRONG_RESULT_MULT` × price (default 1.5×) → eligible upsell.
- **Weak:** result ≤ `AI_FUNNEL_WEAK_RESULT_MULT` × price (default 0.25×) → downsell / right-size.
- Between the two → hold + optimize, then re-review.

Results come from the real engines: advertiser products read `attributedSalesUsd` (platform-attributed
sales); member products read the member's own generated value. **Individualized real figures only** — never
a projection or a "customers like you" claim.

## Guardrails (load-bearing, not optional)

1. **Suitability guard on financial products.** A product with `financial:true` (the financed Tier 1, the
   Goods Advance) can **never** be an upsell target unless (a) it is **live** AND (b) the customer's
   **ability-to-repay is confirmed**. Both are currently OFF/false by default, so the concierge cannot push
   anyone into credit today. Downsell toward cheaper/free is always allowed. Controlled by
   `AI_FUNNEL_REQUIRE_SUITABILITY_FOR_FINANCIAL` (do not disable). This is the UDAAP/FTC line: an AI that
   upsells vulnerable users into debt is exactly what regulators look for.
2. **Truthful results only.** Gate 2 shows the customer's own actual number. Aggregate/typical-earnings
   claims are FTC earnings claims and are not made.
3. **No dark patterns.** `AI_FUNNEL_MAX_UPSELL_ATTEMPTS` (default 2) caps upsell pitches; a decline is
   respected and the concierge switches to right-size/hold. It discloses it's an automated assistant and that
   the customer can say no.
4. **Human oversight.** Every decision is logged (`FunnelJourney`) so the existing AI-oversight feed can
   watch and a human can stop it.

## Where it lives in code

- Flag: `ai_funnel` (default ON). Settings category "AI Funnel": `AI_FUNNEL_PRODUCT_GRAPH`,
  `AI_FUNNEL_STRONG_RESULT_MULT`, `AI_FUNNEL_WEAK_RESULT_MULT`, `AI_FUNNEL_MAX_UPSELL_ATTEMPTS`,
  `AI_FUNNEL_REQUIRE_SUITABILITY_FOR_FINANCIAL`.
- Engine: `backend/sdk/ai-funnel.ts` — `recommendAtPurchase` (Gate 1), `reviewOnResults` (Gate 2),
  `suitabilityAllows`, product-graph getters, disclosures.
- Entity: `FunnelJourney` (owner-scoped) — schema + rls.
- Functions: `aiFunnelRecommend` (Gate 1), `aiFunnelCommit` (start the window), `aiFunnelResultsReview`
  (Gate 2). All flag-gated and logged.
- Page: `/AIFunnelConcierge` — a live demo of both gates with the suitability guard visible.
- **Auto-launch:** `src/components/ConciergeLauncher.jsx` is mounted globally in `App.jsx` and **auto-greets
  as soon as a visitor lands on a business-product route** (Founding Advertiser, Founding Upgrade, PPC
  Marketplace, Business Portal, Pricing, Tier 1 Financed, ad/campaign dashboards — the `BUSINESS_PAGES` map,
  which mirrors the product-graph keys). It opens a small dismissible panel, runs Gate 1 when the visitor
  answers, and seeds the recommendation with the product they're viewing. Anti-annoyance rules: it opens
  **once per product per session**, is dismissible, never re-nags after a dismiss, and if the `ai_funnel`
  flag is off the backend returns `funnel_off` and the launcher hides itself. Edit `BUSINESS_PAGES` to change
  which routes trigger it.

The concierge recommends and logs. It does not charge, and it cannot push anyone into a credit product.
