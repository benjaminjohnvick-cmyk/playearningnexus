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
