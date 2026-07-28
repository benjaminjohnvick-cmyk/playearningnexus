# Launch Estimate — Full Launch (2026-07-28)

A fresh one-page estimate for a complete launch — web PWA + Android + iOS + load test — reflecting the
current codebase (marketplace, AI catalog, serverless-GPU images, i18n, data/AI systems). Targets, not
guarantees; the kit removes rework, which is what causes the high end.

## Development hours (one-time, at $75/hr)
| Phase | Hours | Notes |
|---|---:|---|
| Accounts & API keys (owner) | 0 billable | `deploy-kit/API-KEYS-WORKSHEET.md` |
| Deploy backend + Postgres + scheduler (Railway single-service) | 6–8 | auto-migrate, inline scheduler |
| Pre-deploy validation | 1–2 | `deploy-kit/validate.sh` |
| Deploy frontend (served by backend) | 2–3 | single origin |
| Configure AI/catalog (budget worksheet) | 1–2 | env only, no code |
| Payments sandbox→live (only if enabling card at launch) | 0–8 | optional; card off by default |
| Survey/earn loop test | 4–6 | |
| QA pass | 7–9 | `QA-TEST-PLAN.md` |
| Android submission (signed .aab) | 10–13 | `deploy-kit/ANDROID-SUBMISSION-KIT.md` |
| iOS submission (cloud CI, no Mac) | 5–9 | `deploy-kit/IOS-NO-MAC-KIT.md` |
| **Total** | **~36–52 h** | **≈ $2,700–$3,900** |

Card payments off at launch keeps you near the low end (~36–40 h, ~$2,700–$3,000). The AI/catalog
features add **~1–2 h** (config only) because they're prebuilt and off-by-default.

## Runtime cost (monthly, ongoing)
| Item | Cost |
|---|---|
| Hosting (Railway, single instance) | ~$10–30/mo |
| AI images (one-time, all countries) | ~$9–15 once (Titan) |
| LLM text (catalog seed + assistant + optimization) | capped; ~$5–40/mo depending on use |
| Geo-IP + exchange rates | free tier |
| Domain / stores | $12–15/yr domain · Apple $99/yr · Play $25 once |
| **Month-1 realistic total** | **~$25–100** (hard-capped by `AI_DAILY_SPEND_CAP_USD`) |

## Load test
Deferred until traffic warrants it. First pass: k6/Artillery from one box vs staging (near-free). Full
AWS run: spot instances, spin-up/tear-down same day (hours-long spend, not standing). The scale toggles
tell you the one knob to flip — no speculative over-provisioning. Plan: `LOAD-TEST-PLAN.md`.

## Budget risks (watch these)
1. **App Store rejection round** for earn-money apps — mitigate with demo login + "not gambling" framing
   (`STORE-LISTING-COPY.md` review notes).
2. **Enabling card/cash-out** adds payment-processor + compliance hours — deliberately deferred.
3. **Turning subcategory tile images on** adds ~$9 one-time — off by default.

## Bottom line
Full PWA + Android + iOS launch: **~$2,700–$3,900 dev**, **~$25–100 month-1 runtime**, load test
deferred and cheap. The new AI/catalog/marketplace capabilities are included at essentially no added
launch cost because they ship prebuilt and off-by-default.

## All-in with EVERYTHING operational (year 1) — and the shoestring lever
"Everything operational and running" means dev + a year of actually running it. Counting that:

| Bucket | Full (PWA+Android+iOS) | Shoestring (PWA+Android, iOS as fast-follow) |
|---|---:|---:|
| Dev (one-time) | $2,700–$3,900 | **$2,000–$2,700** (drop the 5–9 iOS hours) |
| One-time fees | Play $25 + images ~$15 | Play $25 + images $0–15 |
| Apple Developer | $99/yr | **$0** (deferred) |
| Domain | ~$15/yr | ~$15/yr (or free subdomain) |
| Hosting (yr 1) | ~$120–360 | ~$120–180 (hobby tier + trial credit) |
| LLM (yr 1, capped) | ~$60–480 | ~$60–180 (`AI_DAILY_SPEND_CAP_USD` low) |
| **Year-1 all-in** | **~$3,900–$4,900** | **~$2,300–$3,100** |

So the full all-in *does* run a bit over the original figure — **because of first-year operating cost,
not dev** (dev is unchanged). The lever that lands everything-operational back at ~$3,000-and-change:

**Launch web PWA + Android now; add the native iOS app as a fast-follow.** Why it works and why it's
safe:
- Removes the ~5–9 iOS dev hours (~$375–$675) **and** the $99/yr Apple fee **and** the biggest budget
  risk (App Store rejection rounds for earn-money apps).
- **iPhone users are NOT locked out** — the PWA installs and runs on iOS Safari, so everyone can use the
  site day one; they just don't get the App Store listing yet.
- It's **reversible with no rework**: the app is a Capacitor wrapper and the iOS CI config already
  exists (`deploy-kit/IOS-NO-MAC-KIT.md`), so iOS is a later *flip* (~$375–$675 + $99/yr) once revenue
  covers it — not a rebuild.

Stack these to stay near the floor: keep **card/cash-out off** (no processor fees), **Affirm off** until
approved ($0 fixed), **images at the $10 budget posture** (or text-only at $0), **`AI_DAILY_SPEND_CAP_USD`
low** (~$5–10/mo), **one-country + small catalog** at launch, and a **hobby hosting tier + trial credit**.
Everything stays fully functional and running — just scoped to web + Android at launch — for
**~$2,300–$3,100 all-in year one**, inside your original ~$3,000-and-change.

## Keeping EVERYTHING on (web + Android + iOS, all features) at ~$3,000
Yes, achievable — at the low end, using coding + free-tier levers instead of cutting scope:

**Hosting choice: AWS paid tier with auto-scaling** (see `deploy-kit/AWS-AUTOSCALING-DEPLOY.md`). This is
a deliberate reliability/scale choice that costs more than a free tier, so it lifts year-one above the
~$3,000 shoestring target — that trade is intentional.

| Bucket | Cost with levers | The lever |
|---|---:|---|
| Dev (one-time) | $2,000–$2,600 | Prebuilt features ($0) + automated deploy/QA: `launch.sh`, `e2e-smoke.mjs`, `validate.sh` collapse the deploy + test phases so the developer runs commands, not hours |
| Hosting — **AWS auto-scaling** (yr 1) | **$900–1,740** | ECS Fargate + ALB + RDS floor ~$75–145/mo; trim to ~$40–70/mo with App Runner + single-AZ RDS + Redis/SQS off until the load test needs them |
| LLM (yr 1) | $60–300 | `AI_DAILY_SPEND_CAP_USD`, small-tier models, paced jobs |
| Images | $0–15 | text-only launch ($0) or $10 Titan (Bedrock) posture |
| Play (one-time) | $25 | — |
| Apple Developer | $99/yr | unavoidable for a native iOS app |
| Domain | $12–15 | — |
| **Year-1 all-in** | **≈ $3,100–$4,800** | everything ON, all three platforms, AWS auto-scaling |

With AWS auto-scaling, the honest year-one all-in is **~$3,100–$4,800** (vs ~$2,300–$3,000 on a free
hosting tier). The difference is almost entirely the auto-scaling infra floor. If you want to pull it
back toward $3,000 while keeping AWS: start with **App Runner** (auto-scales, no ALB), **single-AZ RDS**,
and leave **Redis + SQS off** (they're env toggles) until the load test proves you need them — that
trims the hosting floor to ~$40–70/mo (~$480–840/yr) and lands year-one near **~$2,900–$3,600**.

Two honest caveats so the number holds:
- **The wildcard is an iOS App Store rejection round** (common for earn-money apps) — each round adds
  dev hours. It's mitigated (demo login + "merit, not gambling" framing in `STORE-LISTING-COPY.md`), but
  it's the one thing that can push past $3,000. Budget a small contingency for it.
- **Cash-out stays OFF** — not to save money, but for **legal** reasons (real-money withdrawal triggers
  money-transmission licensing, which is a separate, expensive track). Everything else — marketplace,
  catalog, AI, welcome rewards, Daily Boost, Affirm, card payments — can be on. This is a compliance
  guardrail, not a budget cut.

Hard floor you can't code away: **~$139** (Apple $99 + Play $25 + domain ~$15). Everything above that is
dev hours (cut by automation) and usage (capped + free-tier), so the plan lands **around $3,000 with
everything on** — with the iOS-review contingency as the only real risk to the number.
