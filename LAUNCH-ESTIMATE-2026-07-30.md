# GamerGain — Launch Cost Estimate (floor edition)

> ## ⭐ CURRENT RECONCILED ESTIMATE — 2026-08-15
>
> **All GamerGain / Get Goods Gratis launch-cost docs use these figures. Where an older number appears
> anywhere below, this banner supersedes it.** (Reflects everything built through 2026-08-15: the AI concierge
> funnel + auto-launch, the public `/Apply` page marketing the Founding offer + "coming soon" financing, the
> results/benchmark auto-compilers and per-product stats, the Tier 2 "Scale" pay-as-you-go ladder +
> deliverables, the founding rollover/upgrade discount + $2,000 premium gift boost, and the stronger cost floor —
> one-click in-app + `AI_FORCE_CHEAP_TIER` that dumps every AI call onto the small Llama. The `/Apply` page is a
> read + a lead form, so it adds capability, not launch or runtime cost.)
>
> - **The launch number did NOT rise.** Every feature added this session ships **prebuilt and ON**, so it adds
>   capability, not launch cost. The credit features (flexpay / financed Tier 1 / goods advance) ship **OFF by
>   design** behind a counsel gate, so they add **$0** legal cost at launch.
> - **Full launch — web PWA + Android + native iOS: ~$2,900–$4,000 year-one all-in.** Developer labor
>   ~$2,050–$3,150 (≈ 28–42 hours @ $75/hr) — deploy, test, submit, and stand up the scheduler; no product build.
> - **Shoestring — web PWA + Android (iOS as fast-follow): ~$2,000–$2,800.**
> - **Hard external cash floor: ~$139** all three platforms (Apple $99/yr + Google Play $25 + domain ~$15);
>   **~$40** shoestring (no Apple fee — the PWA covers iPhone via Safari).
> - **Recurring: AI / media / email $0/mo** — free tiers + the one-click cost floor; with `AI_FORCE_CHEAP_TIER`
>   on, every call runs on Llama-8B so the LLM line is now ~$0–20/mo (was $5–40). Hosting ~$10–35/mo (backend +
>   Postgres + the always-on **scheduler** service). **Legal $0** at launch (credit features off). **Optional**
>   AWS auto-scaling + load test lifts the ceiling to ~$3,100–$4,800.
>
> *Older single figures in these docs predate the kit/automation + cost floor that trimmed the numbers; the
> banner above is current.*


> **Posture: everything is ON, up, and running from the get-go.** There is no build phase — the product
> ships feature-complete with every flag ON by default and pre-warms its own content, so launch is deploy +
> test + submit only. That is *why* these numbers are this low. See `EVERYTHING-ON-FROM-DAY-ONE.md`.

**Prepared 2026-07-30 · Supersedes the 2026-07-28 estimate · Figures are planning targets, not quotes**

This revision folds in the work completed tonight and re-states the posture you asked for: **everything
running and on from the get-go**, with the developer cost driven to its honest floor. Tonight's additions
are the auto-qualify → one-tap Premium path and the Services marketplace section brought to full parity
with the other sections (serverless-GPU category tiles + subsections + search). Both shipped **prebuilt
and switched ON by default**, so they add capability without adding launch cost.

---

## Does tonight's work actually run?

Straight answer: it is **verified-correct, not yet runtime-proven** — and that distinction matters, so
here is exactly what was and wasn't checked.

What passed, tonight, on every file: the structural audit (657 backend functions, 0 guardrail warnings),
a TypeScript syntax sweep, brace/paren/bracket balance, JSON validity for the manifest and scheduler,
every relative import resolving to a real file on disk, all four new backend functions registered in the
manifest, and the frontend wiring (the Premium banner mounted in the dashboard, the Services page calling
the GPU-category API, the page routed in `pages.config.js`). Each new function is also a near-line-for-line
mirror of an existing, already-working one — `premiumAcceptOffer` mirrors `loyaltyEnroll`,
`serviceStoreCategories` mirrors `appStoreCategories`, `aiServiceCategoryImages` mirrors
`aiAppCategoryImages` — so it inherits proven patterns rather than inventing new ones.

What could **not** be checked here: a live boot. This build environment has no Deno runtime and no live
Postgres, so nothing was executed against a real database. That first true runtime happens the moment you
push to GitHub and Railway rebuilds. The one-command `e2e-smoke` in the kit is what proves the earn→unlock
→purchase loop on the live instance, and the Premium banner only appears for a user who has actually hit
the survey-day milestone, so plan to confirm both against a seeded test account after the first deploy.
Nothing tonight touched money math or the payout rails, which keeps the runtime risk low.

---

## Everything on from the get-go — the flag posture

The platform ships with essentially every capability **live at launch**, not dark. That is a code fact,
not a promise: the built-in flag defaults turn the features on. The only things held off are held off for
a specific external prerequisite — a processor account, an opt-in record, or a licensing question — not to
save money, and each is a one-line flip once its prerequisite exists.

| On by default (runs day one) | Off by default (and the specific reason) |
|---|---|
| Premium PPC · Loyalty/Rewards · auto-qualify Premium | Card charging — needs a live Stripe/PayPal processor + legal sign-off |
| Marketplace: Physical · Digital · Services (GPU tiles) | Affirm BNPL — needs Affirm merchant keys (real shippable goods only) |
| AI catalog, assistant, optimizer, self-learning, live experiments | SMS marketing — needs verifiable TCPA opt-in |
| **AI concierge funnel + auto-launch on business pages** (`ai_funnel`) | Teen accounts — needs verifiable parental consent + counsel |
| **Results/benchmark auto-compilers + per-product stats** | Store-credit purchase & P2P transfers — money-transmission risk |
| **Tier 2 "Scale" pay-as-you-go ladder + deliverables** (not credit) | Earnings projections — FTC earnings-claims review |
| **Founding rollover/upgrade discount + $2,000 premium gift boost** | **`flexpay` (installment credit)** — licensed provider *or* attorney-confirmed self-financed |
| KYC survey · welcome rewards · Daily/Points Boost · layaway · purchase-payback | **`tier1_financed` (recourse credit)** — licensed creditor + counsel |
| Referrals · jackpots · social posting · **consent-gated email re-engagement** · telemetry · UX heatmap | **`goods_advance` (advance credit)** — licensed provider + counsel |
| **Partner cash-out** (closed-loop for regular users, ON) | |

So "everything on" is already the shipped state — including every feature added this session. The right-hand
column is unchanged in spirit: guardrails held for a specific external prerequisite (a processor, an opt-in,
or a licensing/counsel question), each a one-line flag flip once that prerequisite lands. The three **credit**
products added this session sit there too — off by design, **$0 legal cost until you choose to unlock one**.
The results-claims story runs compliant with no counsel: a hypothetical "how it works" shows until real data
passes the sample threshold, then the substantiated figure auto-publishes with its basis.

---

## One-time development — driven to the floor

Billed at $75/hour. Because tonight's features (and the AI, catalog, and marketplace layers before them)
are prebuilt, the developer spends **zero** hours building product — only deploying, testing, and
submitting. That is why the number keeps falling: there is less and less hand-work left.

| Work item | Hours | Note |
|---|---:|---|
| Accounts & API keys | 0 billable | Owner-completed from the keys worksheet |
| Deploy backend + Postgres + frontend | 5–7 | Auto-migrating, same-origin frontend |
| Stand up the **scheduler** service (daily jobs) | 1 | Deploy `backend/scheduler/main.ts` as an always-on process (Handwork §E) |
| Pre-deploy validation | 1 | Scripted (`validate.sh`) |
| Configure AI / catalog / **flip the cost floor on** | 1–2 | Environment + flags only — no code, all prebuilt |
| Survey / earn-loop live test | 3–5 | `seed-demo` + `e2e-smoke` |
| QA pass | 5–7 | Against the QA test plan |
| Android submission (signed .aab) | 8–11 | Android submission kit + fastlane |
| **Subtotal — PWA + Android** | **~24–34** | **≈ $1,800–$2,550** |
| iOS submission (cloud CI, no Mac) | +4–8 | iOS-without-a-Mac kit |
| **Total — PWA + Android + iOS** | **~28–42** | **≈ $2,050–$3,150** |

Card payments stay off at launch, so the 0–8 "payments go-live" hours from prior estimates are out of the
launch number entirely — that work moves to whenever you turn card charging on.

---

## Ongoing runtime (monthly) — floor posture

| Item | Cost |
|---|---|
| Hosting — backend + Postgres + the always-on **scheduler** service | ~$10–35/mo |
| Catalog + category images, one-time all-in | ~$11–19 once |
| LLM text — catalog, assistant, concierge funnel, compilers | Now **~$0–20/mo** with `AI_FORCE_CHEAP_TIER` (all calls on Llama-8B), under the daily cap |
| AI / speech-to-text / TTS / email | **$0** (free tiers, or your self-hosted endpoints) |
| Legal & compliance | **$0** at launch — credit features off; optional one-time attorney read only if you unlock `self_financed` flex on day one |
| Geo-IP + exchange rates | Free tier |
| **Realistic month one** | **~$15–75**, capped |

The one genuinely new recurring line is the **scheduler** — a second always-on process that runs the daily
jobs (catalog seed, optimizer, self-learning, funnel benchmark compile, re-engagement sweep, product-stats
compile, loyalty/points reconcile). It's a small service (a few $/mo, or free if co-located), and without it
the automation jobs don't fire — so it's now an explicit deploy step (Handwork §E). Everything else this
session added **zero** per-user cost: the concierge funnel, stats, and Tier 2 ladder are all reads over data
you already store.

---

## The floor — and why it isn't zero

| Path | Year-one all-in | What it takes |
|---|---:|---|
| **Absolute shoestring** (web PWA + Android, iOS as fast-follow) | **~$2,000–$2,800** | Dev $1,725–2,475 · Play $25 · domain ~$15 · hosting ~$120–180 · LLM capped ~$60–180 · images ~$0–19 |
| Full three platforms (adds native iOS) | ~$2,900–$4,000 | + iOS dev $300–600 · Apple $99/yr |
| Full three + AWS auto-scaling | ~$3,100–$4,800 | + the auto-scaling infra floor (App Runner + single-AZ RDS trims it) |

The hard external floor you cannot code away is about **$40** on the shoestring path — Google Play $25 plus
a ~$15 domain — because the PWA installs on iOS Safari, so iPhone users are covered without the $99 Apple
fee until you choose to ship the native iOS app. Add native iOS and the fixed floor becomes ~$139 (Apple
$99 + Play $25 + domain $15). Below that sits only the human/external time that no automation removes:
you creating the provider accounts, the first-run dashboard setup, and Google/Apple review. That residue —
not code — is the real floor.

---

## Bottom line

With this session's additions — the AI concierge funnel, the results/benchmark/product-stats compilers, the
Tier 2 "Scale" ladder and its deliverables, and the founding rollover/discount — all prebuilt and **on by
default**, the launch cost did **not** rise. More of the platform is build-complete, so the developer still
only deploys, tests, submits, and now also stands up the scheduler. A web + Android launch with **everything
running from day one** lands at roughly **$2,000–$2,800 all-in for year one**; adding native iOS puts it near
**$2,900–$4,000**. The irreducible fixed floor is **~$40** shoestring (Play + domain), **~$139** with native
iOS. Recurring cost fell at the margins: the stronger cost floor (`AI_FORCE_CHEAP_TIER`) trims the LLM line to
~$0–20/mo, and legal cost is **$0** at launch because every credit product ships off behind its counsel gate.
The only real risk to the number remains an iOS App Store rejection round — mitigated by the demo login and
merit-not-gambling framing already in the kit.
