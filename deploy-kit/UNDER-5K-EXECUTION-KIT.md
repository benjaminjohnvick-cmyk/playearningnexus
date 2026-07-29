# Under-$5K Execution Kit — GamerGain / PlayEarning Nexus

**Purpose:** get a developer from "code on GitHub" to "live on web + Android + iOS" for **≤ $5,000**
at **$75/hr (≤ ~66 billable hours)**. It works by removing the guesswork — every phase below ships
with the exact config, copy, and steps, so the developer runs near the *low* end of the estimate
instead of the high end.

**Stack chosen:** Railway (all-in-one) · iOS built in the cloud (no Mac).

---

## The number

| Phase | Before (h) | With this kit (h) | The file that cuts it |
|---|---:|---:|---|
| Accounts & API keys | 8–12 | 6–8 | `API-KEYS-WORKSHEET.md` |
| Deploy backend + Postgres + scheduler | 10–14 | 6–8 | `railway/RAILWAY-DEPLOY.md` + `railway/backend.railway.json` |
| Pre-deploy validation | 3–6 | 1–2 | `validate.sh` |
| Deploy frontend | 4–8 | 2–3 | `railway/frontend.Dockerfile` |
| Payments sandbox→live | 10–15 | 8–10 | `PAYMENTS-TEST-CHECKLIST.md` |
| Survey loop test | 6–10 | 4–6 | `SURVEY-LOOP-TEST.md` |
| Android submission | 15–22 | 10–13 | `ANDROID-SUBMISSION-KIT.md` |
| QA pass | 10–15 | 7–9 | `QA-CHECKLIST.md` |
| **Subtotal — PWA + Android** | **66–102** | **~44–59** | **≈ $3,300–$4,425** |
| iOS submission (cloud CI, no Mac) | +6–12 | +5–9 | `IOS-NO-MAC-KIT.md` + `ci/` |
| **Total — PWA + Android + iOS** | | **~50–66** | **≈ $3,750–$4,950** |

**Bottom line:** PWA + Android lands **comfortably under $5k** (~$3.3–4.4k). Adding iOS via cloud CI
keeps you **right around $5k** — the only thing that can push it over is an Apple review rejection
round (common for earn-money apps), so treat that as the single budget risk. There's no Mac purchase.

> These are targets, not guarantees. The kit removes *discovery and rework* — the biggest causes of
> the high-end blowout. A clean run lands near the low column; a messy provider approval or an App
> Store rejection adds hours. Keep iOS review clean (demo login, "not gambling" framing) to protect the number.

---

## Order of operations (hand this whole folder to the developer)

1. **Owner first:** fill in `API-KEYS-WORKSHEET.md` (account signups are not billable dev work).
2. `bash deploy-kit/validate.sh` — prove the build is green before touching the cloud.
3. **Railway:** follow `railway/RAILWAY-DEPLOY.md` → Postgres, backend, scheduler, frontend live.
4. **Money & loop:** run `PAYMENTS-TEST-CHECKLIST.md` then `SURVEY-LOOP-TEST.md` (sandbox → live).
5. **QA:** run `QA-CHECKLIST.md` on the live app.
6. **Android:** `ANDROID-SUBMISSION-KIT.md` → signed `.aab` → Play Console.
7. **iOS (no Mac):** `IOS-NO-MAC-KIT.md` → Codemagic (`ci/codemagic.yaml`) or GitHub Actions
   (`ci/ios-build.yml`) → TestFlight → App Store.

## What is NOT in the $5k (unavoidable, not "development")
- Apple Developer **$99/yr** · Google Play **$25** one-time · domain **~$12–15/yr**.
- Monthly hosting: Railway at launch traffic **~$10–30/mo**; provider/LLM usage on top (usage-based).
- Optional lawyer review of Privacy/Terms (templates provided; sign-off is the cost).

## How to protect the budget (owner playbook)
- Do the **account signups yourself** — never pay dev hours for forms.
- Insist on **Phase 2 validate.sh** before any cloud work — it kills the #1 surprise.
- Ship **Android + iOS via CI** — no Mac purchase, no per-platform rewrite.
- Keep the **iOS review clean** (demo login, merit-not-gambling framing) to avoid rejection-round hours.
- Defer the **full AWS load test** until real traffic justifies it (the plan is ready when you need it).

---

## Automation added (drives the estimate down further)

New scripts/flags now in the kit and codebase — they replace hand-work, lowering the launch to
**~30–45 h (~$2,250–$3,375)**, or **~38–57 h (~$2,850–$4,275) with the load test**:

- **`deploy-kit/launch.sh`** + **`deploy-kit/env-check.mjs`** — validate keys (pings each provider) and prep.
- **`deploy-kit/railway/railway-deploy.sh`** — provisions Postgres, pushes env vars, deploys via the Railway CLI.
- **Backend flags** — `AUTO_MIGRATE` (schema loads itself on boot), `SCHEDULER_INLINE` (one service, not two),
  `FRONTEND_DIR` (backend serves the built frontend → no separate frontend deploy, no CORS).
- **`deploy-kit/e2e-smoke.mjs`** — one-command critical-path test (signup→survey→store→payout).
- **`backend/tools/seed-demo.ts`** — instant demo data for testing/review.
- **`fastlane/`** + **`deploy-kit/mobile/gen-screenshots.mjs`** — one-command store submission + auto screenshots.
- **Reviewer demo mode** — `/ReviewerLogin` + gated `demoLogin` function (set `REVIEWER_DEMO=1`) for clean App Store review.
- **Native push** — wired in `src/lib/native.js` + `registerPushToken` function.
- **Agent tooling** — `backend/tools/validate-guardrails.mjs` (money-safety: all agents pinned+capped),
  `agent-smoke.mjs` (config integrity), `agent-dedupe-report.mjs` (consolidation candidates).
- **AI-provider & scale toggles** (see `AI-PROVIDER-AND-SCALE-TOGGLES.md`) — the **Claude switch**
  (`LLM_PROVIDER=anthropic` routes all AI + 76 agents through Claude), an **image-provider toggle**
  (`IMAGE_PROVIDER`), and **dormant scale knobs** (`REDIS_URL`, `DATABASE_REPLICA_URL`,
  `QUEUE_DRIVER=sqs`). All off by default and pre-built, so they add **$0** to the estimate — the
  developer sets one env var, not a day of integration work.

---

## Everything ON from day one (2026-07-29) — turnkey defaults, $0 added

Everything the app does is **on by default** — the launch config *is* the defaults, not a checklist of
switches to flip. `backend/.env.example` is the everything-on template: copy it, add your keys, deploy.
No feature-enablement hours.

**ON out of the box** (see `backend/sdk/feature-flags.ts`): premium PPC + the UP-FRONT grant, AI social
advertising + its self-learning loop, one-tap posting, survey make-up, the self-learning/optimizer loop,
live experiments + personalization, KYC survey, points boost, physical + digital store, layaway, jackpots,
email — and the global AI switch is **live** (`ai_paused=false`; a human can hit stop + correct any time
via the Live Oversight feed).

**OFF on purpose** — being off is a launch *enabler*, not missing work: `card_charging`, `cash_out`,
`store_credit_purchase`, `p2p_transfers` (closed-loop / money-transmission), `multi_level_referrals`
(single-tier only), `sms_marketing` (TCPA), `earnings_projections` (FTC), `affirm_bnpl` (until merchant
keys), `teen_accounts` (parental-consent + counsel). Each is one flag flip once its processor/legal
prerequisite is met — never a rebuild.

## The number holds — target ≤ $3,900

The whole 2026-07-29 feature set (PPC up-front model, AI advertising + learning, one-tap posting, survey
make-up, lockout mode, compliance backstops) shipped **pre-built, on-by-default, and self-scheduled** (the
daily auto-advertiser is already in `backend/scheduler/schedules.json`). By the kit's own rule — *pre-built
+ toggle = the developer sets a variable, not builds a feature* — it adds **$0** to the launch estimate.
The developer's job is unchanged: deploy, smoke-test, submit.

| Path | Dev hours (kit + automation) | Cost @ $75/hr |
|---|---:|---:|
| PWA + Android | ~28–38 h | ~$2,100–$2,850 |
| Full launch (+ iOS via cloud CI) | ~34–52 h | **~$2,550–$3,900** |

The only thing that can push past $3,900 is an **Apple review rejection round** — keep the review clean
(demo login via `REVIEWER_DEMO=1`, merit-not-gambling framing). AI runtime is separately capped by
`AI_DAILY_SPEND_CAP_USD` and can launch at ~$0, so turning everything on does not move the monthly bill.

---

## Automation maxed out (2026-07-29) — driving billable hours to the floor

Two more phases that used to be hand-work are now scripted, so the developer runs them in minutes
instead of hours:

- **`deploy-kit/validate.sh` is now a full pre-deploy audit** — on top of the frontend build + backend
  type-check, it verifies **every entity has a table** (entities.json ↔ schema.sql), **every scheduled
  job resolves to a real function**, and the **function manifest is valid with no duplicates**. These are
  the exact drift bugs that otherwise surface *after* deploy and cause the high-end blowout. Catching them
  locally in ~1 minute turns pre-deploy validation from **3–6 h → ~0.5 h** and removes most cloud rework.
- **`deploy-kit/e2e-smoke.mjs` is now an automated QA pass** — it walks the full critical path
  (signup → login → survey read → store order → payout) **and** the new-feature routes (KYC survey,
  Premium PPC status + make-up + lockout, AI ad queue, one-click purchase, Points Boost, marketplace
  taxonomy, AI Live Oversight). One command asserts every launch-critical route is alive. This turns the
  **QA pass from 7–9 h of manual clicking → ~1 h** (run it, read the pass/fail list, spot-check the UI).
- **`deploy-kit/launch.sh` runs the QA smoke automatically** once `BACKEND_URL` is set — validate,
  generate secrets, load schema, then QA, in one command.

### The honest floor

Scripts can't create your accounts, click your host's dashboard, set CI signing secrets, or pass Apple/
Google review — those are the irreducible human steps, and **most aren't billable dev at all** (owner
signups) or are one-time setup. What actually remains for the developer, with everything above automated:

| Remaining work (human-only) | Typical hours |
|---|---:|
| Railway dashboard: create project, Postgres, first deploy | ~3–5 h |
| CI signing secrets (Android keystore, iOS cert/profile) | ~2–3 h |
| Store console upload + review responses (Android + iOS) | ~5–9 h |
| Live-payments wiring | **$0 at launch** (closed-loop; `card_charging` off) |
| **Full launch (PWA + Android + iOS), realistic** | **~14–24 h → ~$1,050–$1,800** |

**Bottom line: with the kit maxed out, the automatable dev work approaches zero and the realistic
developer bill for a full PWA + Android + iOS launch lands around $1,050–$1,800 — well under $3,900.**
The one thing that can still add hours is an **Apple review rejection round** (keep it clean: demo login
via `REVIEWER_DEMO=1`, merit-not-gambling framing). Owner account signups and optional legal review are
separate from dev hours; AI runtime stays capped by `AI_DAILY_SPEND_CAP_USD` and can launch at ~$0.

<!-- last synced to remote: 2026-07-29 (GamerGain 9) -->
