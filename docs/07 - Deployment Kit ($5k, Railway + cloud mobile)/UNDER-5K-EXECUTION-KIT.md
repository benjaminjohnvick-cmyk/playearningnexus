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
