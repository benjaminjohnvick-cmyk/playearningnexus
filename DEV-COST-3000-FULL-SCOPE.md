# Development Cost — $3,000, Full Scope (Definitive)

**Prepared 2026-09-08 · This is the definitive development-cost figure. Where any other doc shows a different
*developer-labor* number for the full launch, this supersedes it.**

---

## The number

> ## ⭐ Development cost: **$3,000** — 40 hours @ **$75/hour**, full scope, everything ON from the get-go.

Live hosting / screen-share (LiveKit) is **included in scope at $0 added dev cost** (built in-session; ships gated OFF + counsel-gated, so it does not change these 40 hours or the launch estimate). "Development cost" = **developer labor only**, at **$75/hour**. Forty hours × $75 = **$3,000**. Nothing in the
scope below is left out.

## What "full scope" includes — nothing omitted

- **Web PWA** — live at launch.
- **Android** — built, signed, submitted.
- **native iOS** — built (cloud CI, no Mac) and submitted.
- **AWS auto-scaling** — App Runner + RDS, scaling policies, CloudWatch alarms + AWS Budgets.
- **Load test** — the full user-capacity test (`LOAD-TEST-PLAN.md`).
- **All features ON from day one** — every feature flag defaults ON; the developer deploys an already-complete
  product, they do not build one.

## The 40-hour breakdown ($75/hr = $3,000)

| Phase | Hours | Cost |
|---|---:|---:|
| Deploy backend + Postgres + scheduler + frontend (one service) | 5 | $375 |
| Pre-deploy validation (scripted `validate.sh`) | 1 | $75 |
| Configure AI / catalog + **turn all features ON** (env + flags, no code) | 2 | $150 |
| Survey / earn-loop live test (`seed-demo` + `e2e-smoke`) | 3 | $225 |
| QA pass (against the QA test plan) | 5 | $375 |
| **Android** build + submit (fastlane + auto screenshots) | 8 | $600 |
| **native iOS** build + submit (cloud CI, no Mac) | 4 | $300 |
| **AWS auto-scaling** setup (App Runner + RDS + scaling policies + CloudWatch/Budgets) | 4 | $300 |
| **Load test** (user-capacity, `LOAD-TEST-PLAN.md`) | 8 | $600 |
| **TOTAL** | **40** | **$3,000** |

## Why $3,000 holds

- **There is no product-build phase.** Every feature ships prebuilt and switched **ON** by default (a code
  fact — the feature-flag defaults enable them). The developer only **deploys, tests, submits, and scales** —
  they never spend an hour building product. That is what fits the full scope into 40 hours.
- **The execution kit drives to the low end.** Scripted deploy, auto-migrating DB, fastlane, cloud iOS CI,
  `e2e-smoke`, the AWS scripts, and `LOAD-TEST-PLAN.md` replace hand-work, so the developer runs at the low end
  of each phase rather than the high end.
- **Recent AI work added $0 labor and $0 runtime.** The swappable model module, GPT-6 Astra, the unified
  gateway, the autonomy gate + oversight, and the AI SEO / AI-search layer all ship prebuilt and **default to
  the free/cheap tier** (Astra and the gateway are off behind the cost brake; SEO runs on the free tier;
  autonomy is logic). They add capability without adding a development hour or a recurring dollar.

## The one honest caveat

The single thing that can push a *specific* developer past 40 hours is an **iOS App Store rejection round** — a
resubmit costs a few hours. The kit mitigates this with the demo-login reviewer mode and the merit-not-gambling
framing. Treat any App Store rework as the **one named exception** to the $3,000; everything else is scriptable
work that fits the 40 hours.

## What is NOT development cost (separate from the $3,000)

These are **your** accounts and spend, billed to you directly — not developer labor:

- **Fixed fees:** Apple Developer **$99/yr**, Google Play **$25** (one-time), domain **~$15/yr**.
- **Recurring:** hosting / AWS infra spend, and LLM/provider usage — capped and near-$0 on the free-tier
  defaults; AWS auto-scaling infra is a monthly spend you control, not a build cost.
- **Optional:** legal review.

## Reconciliation

This figure is the **development-cost single source of truth**. The `UNDER-5K-EXECUTION-KIT.md` banner (the doc
all launch-cost docs defer to) points here for the full-scope developer-labor number; older labor figures in
any estimate doc that differ are superseded by this one. All-in year-one totals (which add the fixed fees and
recurring spend above) continue to live in `UNDER-5K-EXECUTION-KIT.md`; this doc pins the **development cost**
specifically.

*Figures are planning targets at $75/hr, not a fixed-price quote. The 40-hour scope assumes the pre-built
execution kit is run to the low end, with an App Store rejection round as the one named exception.*
