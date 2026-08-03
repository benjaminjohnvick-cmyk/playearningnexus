# GamerGain — Launch Cost Estimate

> ## ⭐ CURRENT RECONCILED ESTIMATE — 2026-08-03
>
> **All GamerGain launch-cost docs use these figures. Where an older number appears anywhere below, this
> banner supersedes it.** (Reflects everything built through 2026-08-03: the scale flywheels + Services page,
> the opt-in shopping extension, and the one-command cost floor.)
>
> - **Full launch — web PWA + Android + native iOS: ~$2,900–$4,000 year-one all-in.** Developer labor is
>   ~$2,025–$3,075 (≈ 27–41 hours @ $75/hr) — deploy, test, and submit only, because every feature ships
>   prebuilt and ON.
> - **Shoestring — web PWA + Android (iOS as fast-follow): ~$2,000–$2,800.**
> - **Hard external cash floor: ~$139** for all three platforms (Apple $99/yr + Google Play $25 + domain
>   ~$15); **~$40** shoestring (no Apple fee — the PWA covers iPhone via Safari).
> - **Recurring: AI / media / email $0/mo** on free tiers (locked in by `npm run cost:floor`); hosting
>   ~$10–30/mo; LLM capped ~$5–40/mo. **Optional** AWS auto-scaling + full load test adds up to a
>   ~$3,100–$4,800 all-in ceiling.
>
> *Older single figures in these docs (e.g. "$3,750–$4,950" or "under $3,900") predate the kit/automation
> that trimmed the developer hours; the number above is current.*


> **Posture: everything is ON, up, and running from the get-go** — the product ships feature-complete with every flag ON by default and pre-warms its own content, so launch is deploy/test/submit, not build. See `EVERYTHING-ON-FROM-DAY-ONE.md`.

**Prepared 2026-07-28 · Brand-new estimate · Figures are planning targets, not quotes**

This estimate covers a complete launch of GamerGain / PlayEarning Nexus — the web PWA plus native
Android and iOS apps, with a load test held in reserve. It reflects the platform as it stands today:
the AI-generated product catalog, the Facebook-Marketplace-style marketplace, serverless-GPU catalog
imagery, country-by-country localization (currency, language, and flag), welcome rewards, the Daily
Boost perk, and Affirm buy-now-pay-later for real goods. The headline point is that the newer
capabilities ship prebuilt and switched off by default, so they add almost nothing to what it costs to
get live.

---

## One-time development

Development is billed at $75/hour. The launch kit exists specifically to remove rework — the thing that
otherwise drives the high end — by scripting the deploy, validation, and test steps a developer would
otherwise perform by hand.

| Work item | Hours | Note |
|---|---:|---|
| Accounts & API keys | 0 billable | Owner-completed from the keys worksheet |
| Deploy backend + Postgres + scheduler | 6–8 | Single service, auto-migrating, inline scheduler |
| Pre-deploy validation | 1–2 | Scripted (`validate.sh`) |
| Deploy frontend (same origin) | 2–3 | Served by the backend |
| Configure AI / catalog | 1–2 | Environment only — no code, features prebuilt |
| Card payments sandbox → live | 0–8 | Optional; card is off by default |
| Survey / earn-loop test | 4–6 | End-to-end earning path |
| QA pass | 7–9 | Against the QA test plan |
| Android submission (signed .aab) | 10–13 | Android submission kit |
| iOS submission (cloud CI, no Mac needed) | 5–9 | iOS-without-a-Mac kit |
| **Total** | **~36–52 hours** | **≈ $2,700–$3,900** |

Keeping card payments off at launch holds you near the low end — roughly 36–40 hours, or about
$2,700–$3,000. The AI, catalog, and marketplace features add only one to two hours of configuration
because they are already built and default to off.

---

## Ongoing runtime (monthly)

| Item | Cost |
|---|---|
| Hosting (single instance to start) | ~$10–30/mo |
| Catalog images (one-time, all countries) | ~$9–15 once |
| LLM text — catalog seed, assistant, optimization | Capped; ~$5–40/mo by usage |
| Geo-IP + exchange rates | Free tier |
| Domain and store fees | Domain $12–15/yr · Apple $99/yr · Play $25 once |
| **Realistic month one** | **~$25–100**, hard-capped by the daily AI spend limit |

---

## Year-one, all-in

"Everything operational" means development plus a full year of actually running the platform. Two honest
scenarios:

| Bucket | Full (PWA + Android + iOS) | Shoestring (PWA + Android; iOS as fast-follow) |
|---|---:|---:|
| Development (one-time) | $2,700–$3,900 | **$2,000–$2,700** |
| One-time fees | Play $25 + images ~$15 | Play $25 + images $0–15 |
| Apple Developer | $99/yr | **$0** (deferred) |
| Domain | ~$15/yr | ~$15/yr (or free subdomain) |
| Hosting (year 1) | ~$120–360 | ~$120–180 |
| LLM (year 1, capped) | ~$60–480 | ~$60–180 |
| **Year-one all-in** | **~$3,900–$4,900** | **~$2,300–$3,100** |

Development cost is identical across both — the difference is first-year operating cost, not build cost.

---

## The lever that lands "everything operational" near $3,000

Launch the web PWA and Android now, and add the native iOS app as a fast-follow once revenue covers it.
This removes the 5–9 iOS development hours (~$375–$675), the $99/yr Apple fee, and the single biggest
budget risk — App Store rejection rounds, which are common for money-earning apps. Crucially, iPhone
users are **not** locked out: the PWA installs and runs on iOS Safari, so everyone can use GamerGain on
day one. Because the app is a Capacitor wrapper and the iOS CI config already exists, adding iOS later is
a flip, not a rebuild.

Stacking the other levers keeps you at the floor: card and cash-out off (no processor fees), Affirm off
until merchant approval ($0 fixed), images at the ~$10 posture or text-only at $0, the daily AI spend cap
set low, and a single launch country with a small starting catalog. Everything stays fully functional —
just scoped to web + Android at launch — for roughly **$2,300–$3,100 all-in in year one**, inside the
original ~$3,000-and-change target.

---

## Keeping all three platforms and every feature on — with AWS auto-scaling

If you want web, Android, and iOS all live with every feature on and AWS paid-tier auto-scaling for
reliability, that is achievable at the low end using automation and free-tier levers rather than cutting
scope. Auto-scaling infrastructure is a deliberate reliability choice that costs more than a hobby tier,
so it lifts the year-one figure above the shoestring number — that trade is intentional.

| Bucket | Cost with levers | The lever |
|---|---:|---|
| Development (one-time) | $2,000–$2,600 | Prebuilt features ($0) + scripted deploy/QA collapse phases into commands |
| Hosting — AWS auto-scaling (year 1) | $900–1,740 | Fargate + ALB + RDS floor ~$75–145/mo; trim to ~$40–70/mo with App Runner, single-AZ RDS, and Redis/SQS left off until the load test needs them |
| LLM (year 1) | $60–300 | Daily spend cap, small-tier models, paced jobs |
| Images | $0–15 | Text-only launch ($0) or ~$10 image posture |
| Play (one-time) | $25 | — |
| Apple Developer | $99/yr | Unavoidable for a native iOS app |
| Domain | $12–15 | — |
| **Year-one all-in** | **≈ $3,100–$4,800** | Everything on, all three platforms, AWS auto-scaling |

The honest all-in here is about **$3,100–$4,800**, versus ~$2,300–$3,000 on a free hosting tier — the gap
is almost entirely the auto-scaling infrastructure floor. To pull it back toward $3,000 while staying on
AWS, start with App Runner (auto-scales, no load balancer), single-AZ RDS, and Redis and SQS switched off
until a load test proves you need them. That trims hosting to roughly $40–70/mo and lands year-one near
**$2,900–$3,600**.

---

## Load test

Deferred until traffic warrants it, so it adds nothing to the launch number. The first pass runs
k6 or Artillery from a single box against staging, which is nearly free. A full-scale run uses spot
instances spun up and torn down the same day — an hours-long spend, not a standing cost. The scale
toggles identify the one knob to turn, so there is no speculative over-provisioning.

---

## Risks to the number

The main wildcard is an **iOS App Store rejection round**, which is common for earn-money apps and adds
development hours each time it happens. It is mitigated with a demo login and "merit, not gambling"
store framing, but it is the one thing that can push past $3,000, so budget a small contingency.

**Cash-out stays off** — not to save money, but for legal reasons: real-money withdrawal triggers
money-transmission licensing, a separate and expensive track. Everything else — marketplace, catalog,
AI, welcome rewards, Daily Boost, Affirm, and card payments — can be on. This is a compliance guardrail,
not a budget cut.

---

## Bottom line

A full PWA + Android + iOS launch runs roughly **$2,700–$3,900 in development** with **~$25–100 in
month-one runtime**, and the load test stays deferred and cheap. Year-one all-in lands at about
**$2,300–$3,100 on the shoestring path**, **~$3,100–$4,800 with all three platforms on AWS
auto-scaling**, or **near $3,000 with everything on** using the automation and free-tier levers. The
hard floor you cannot code away is about **$139** — Apple $99, Play $25, and a domain around $15 — with
the iOS-review contingency as the only real risk to the number. The AI, catalog, and marketplace
capabilities are included at essentially no added launch cost because they ship prebuilt and off by
default.
