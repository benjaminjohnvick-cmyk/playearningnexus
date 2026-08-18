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
covers both the **business path** (free no-upfront → sponsored placement → Tier 1 → Tier 2 → Tier 3 Unlimited)
and the **consumer path** (free member → premium → points boost), plus the gated financial products. Tier 3
Unlimited is the top of the advertiser ladder (uncapped scaling above the $200k Tier 2 base; advertising value
delivered, not credit — `financial:false`), so a maxed-out Tier 2 advertiser with strong on-platform attributed
results is recommended up to it through the same engine, re-engagement sweep, and suitability logic as every
other product.

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

- **Founding CTA → `/Apply`.** The launcher panel also carries an always-visible gold bar — "Founding
  advertiser spots are limited — see the offer & apply →" — linking to the public **`/Apply`** page. That page
  is the top-of-funnel capture: it markets the Founding Tier 1 offer prominently, shows Tier 2 as available,
  and lists the three credit products as **"coming soon / apply now"** with their live gate status. Applying
  captures a lead (`AdvertiserApplication`) and never charges or originates credit. See
  `APPLY-AND-COMING-SOON.md`.

The concierge recommends and logs. It does not charge, and it cannot push anyone into a credit product.

## Email re-engagement (opt-in only)

The same recommendation can be sent as a **re-engagement email** the customer can reply to — reminding them
of the plan they were looking at (Gate 1) or nudging on their results (Gate 2) and inviting a conversation.

- Function: `funnelReengageEmail` (INTERNAL/ADMIN — a CRM/scheduled job triggers it per customer; a customer
  can't trigger emails to others). SDK: `backend/sdk/funnel-email.ts` builds the subject/body.
- **Consent is a hard gate.** It sends only when `canEmailMarket(user)` passes — the `email_marketing` flag is
  ON, the recipient hasn't opted out, and they have an email on file. No consent → it **skips**, never sends.
  So it works for existing opted-in customers; a raw lead whose email you just captured needs a consent
  record first (capture opt-in before emailing).
- **CAN-SPAM built in.** Every body appends `emailUnsubscribeFooter()` — a working unsubscribe link plus your
  physical mailing address (`BUSINESS_MAILING_ADDRESS`). Subjects are honest (no bait). Set `FUNNEL_EMAIL_FROM`
  to a real, monitored address so replies (the "conversation") actually reach you.
- **Frequency cap:** `FUNNEL_EMAIL_MIN_DAYS_BETWEEN` (default 7) — one funnel email per recipient per window,
  logged to `FunnelEmailLog`. Anti-fatigue / anti-spam.
- Same suitability guard applies to the recommendation, so an email never pitches a credit product to someone
  who isn't eligible.
- Settings: `FUNNEL_EMAIL_ENABLED`, `FUNNEL_EMAIL_MIN_DAYS_BETWEEN`, `FUNNEL_EMAIL_FROM`, `FUNNEL_EMAIL_CTA_PATH`.
- **Jurisdiction note:** CAN-SPAM (US) allows opt-out marketing to existing contacts; **CASL (Canada) and
  GDPR/ePrivacy (EU) require opt-IN.** For those recipients, only email with prior consent. Sending is gated
  on your consent flags, so keep those accurate per jurisdiction.

## Pre-results illustration — hypothetical, NOT "typical return"

Before a customer has their own results, the concierge can show an example of how the product works — but it
is deliberately **not** framed as a "typical return." That distinction is the whole compliance point:

- A **"typical" / "average" / "expected" return** is a regulated earnings claim. It must be backed by
  **competent, reliable evidence** (real data across actual customers), and — critically — **a disclaimer does
  not cure an unsubstantiated claim.** "Results not typical / just an example" language does not make an
  unsupported earnings figure lawful. So a "typical return with a disclaimer," taken literally, is the *risky*
  version.
- What we show instead, from day one, is a **clearly hypothetical "how it works" illustration** — a round,
  made-up figure that demonstrates the mechanics ("e.g. if this drove $X in attributed sales…"), always
  labeled hypothetical, always carrying `AI_FUNNEL_EXAMPLE_DISCLAIMER`: *not a prediction, not a promise, not
  typical, and results may be $0.* This is legal to show with no customer data because it claims nothing about
  what anyone will actually earn.
- When you eventually **do** have real evidence, flip to substantiated figures the honest way: set
  `AI_FUNNEL_BENCHMARKS_SUBSTANTIATED = true` (an attestation that you hold the evidence) and put the numbers
  **with their basis** in `AI_FUNNEL_SUBSTANTIATED_BENCHMARKS` (`{ productKey: { value, basis } }`). A figure
  without a basis is never shown. The engine never fabricates a typical/average.

Settings: `AI_FUNNEL_SHOW_ILLUSTRATIVE_EXAMPLE`, `AI_FUNNEL_EXAMPLE_DISCLAIMER`,
`AI_FUNNEL_BENCHMARKS_SUBSTANTIATED`, `AI_FUNNEL_SUBSTANTIATED_BENCHMARKS`. Logic: `productIllustration()` in
`backend/sdk/ai-funnel.ts`. The illustration rides on Gate-1 recommendations and appears in the concierge
widget, the demo page, and the fit-gate re-engagement email (with the disclaimer attached every time).

### Self-substantiating results (auto-compiled)

`funnelBenchmarkCompile` (scheduled daily) keeps the "results information" current on its own. It aggregates
**real per-customer results** per product — only from customers who have **completed** that product's window —
and, once a product's sample reaches `AI_FUNNEL_BENCHMARK_MIN_SAMPLE` (default 30), **publishes a
substantiated benchmark automatically**: the **median** (default; less outlier-skew than the mean) with a
self-describing **basis** ("median result of N customers over their first W days, as of DATE"). It writes
these into the same `AI_FUNNEL_SUBSTANTIATED_BENCHMARKS` / `AI_FUNNEL_BENCHMARKS_SUBSTANTIATED` settings the
concierge already reads, so the display flips from hypothetical example → real substantiated figure the moment
there's enough data, and updates every day thereafter.

This is what keeps the "typical" claim lawful **automatically**: it is real platform data, only shown at an
adequate sample size, always carrying its basis, and never fabricated. Every computation is also written to
the `FunnelBenchmark` audit entity. Controls:

- `AI_FUNNEL_AUTO_BENCHMARKS` — master on/off for the compiler.
- `AI_FUNNEL_BENCHMARK_MIN_SAMPLE` — how many completed-window customers before a product publishes.
- `AI_FUNNEL_BENCHMARK_METHOD` — `median` (recommended) or `average`.
- `AI_FUNNEL_BENCHMARK_REQUIRE_APPROVAL` — ON records benchmarks as **pending** for admin sign-off instead of
  auto-publishing (extra caution). OFF auto-publishes once the threshold is met.

Run it with `{ "dry_run": true }` to see what it *would* publish (sample sizes per product) without writing.

## Scheduled sweep (runs itself)

`funnelReengageSweep` (INTERNAL/ADMIN, meant to be **scheduled** — e.g. once daily) automates Gate 2: it
walks the **active** `FunnelJourney` records whose commitment window has **closed** and fires the results
email to each eligible customer, so re-engagement runs on its own.

- **Every send obeys the same gates** as the single-send function — `canEmailMarket` (consent), the frequency
  cap, and the suitability guard — so the sweep can't email anyone it shouldn't, and it dedupes to one email
  per customer per run.
- **Actionable by default.** It only emails when there's a real move — an **upsell** (strong results) or a
  **right-size downsell** (weak results). Middling "hold" results are skipped unless
  `FUNNEL_SWEEP_SEND_ON_HOLD` is on, so you're not sending "nothing changed" mail.
- **Bounded.** At most `FUNNEL_SWEEP_MAX_PER_RUN` (default 200) emails per run to protect deliverability; the
  rest are picked up next run (`more_remaining` flags when there's overflow). Pass `{ "dry_run": true }` to
  count who *would* be emailed without sending.
- **Returns a summary:** `scanned`, `window_closed`, `sent`, and a `skips` breakdown (window_open, no_consent,
  frequency_cap, hold_no_action, …) so you can see exactly what it did.

**To schedule it:** wire `funnelReengageSweep` into your platform's scheduled-function / cron mechanism (the
same way the other periodic jobs like the weekly reports run) — a daily invocation is a sensible cadence.
Start with `dry_run:true` for a run or two to sanity-check volumes before it sends for real.
