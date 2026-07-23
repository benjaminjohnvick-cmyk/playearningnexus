# Launch in Under 100 Hours — Updated Plan

**Goal:** total development/deployment time to launch ≤ **100 hours**. This updates the original 55–100h estimate to reflect everything that has since been **built, fixed, and validated for you at no developer cost** — and trims the remaining scope to a plan that lands at **~70–95 hours**.

_Updated July 23, 2026. Companion: `Launch-Hours-Estimate.pdf` (original), `SETUP-RUNBOOK.md` (Step 3.5 has the pre-deploy validation commands)._

## Why the number came DOWN despite more features

Since the original estimate, the following was completed in-session — work a developer would otherwise bill for:

| Already done (0 remaining hours) | Would have cost |
|---|---:|
| Base44 fully removed from live code (incl. survey widget + embed URLs, notifier links) | 4–8h |
| Human-in-the-loop oversight gate on all 35 money/fraud functions + approval UI | 40–55h |
| Per-agent model pinning + cost caps (all 76 agents assigned) | 8–12h |
| Autonomous agent scheduling + event triggers + survey-evidence pipeline | 20–30h |
| Closed-loop payouts (users=credit, partners=cash) enforced at the rails | 8–12h |
| Server-side economy (balances tamper-proof; 10 client sites migrated) | 15–25h |
| Store: server-enforced 10% markup, buy-credit flow, Add Credit nav | 8–12h |
| `vite.config.js` alias fix + frontend build verified green | 2–6h |
| **Total pre-built** | **~105–160h** |

The remaining launch work is now almost entirely **configuration, deployment, and testing** — not feature development.

## The ≤100-hour launch plan (what a developer still does)

| # | Work | Hours |
|---|---|---:|
| 1 | Accounts & API keys (Postgres host, OpenAI, SendGrid, S3, Stripe/PayPal live, Twilio, BitLabs) — follow `CONFIG-AND-SECRETS.md` | 8–12 |
| 2 | Deploy backend (container + managed Postgres + `schema.sql` incl. the 3 new tables) + scheduler process | 10–14 |
| 3 | Pre-deploy validation (Step 3.5: `npm run build` ✅ already proven; `deno check` on Linux) + fix anything it surfaces | 3–6 |
| 4 | Deploy frontend (Amplify or S3+CloudFront, SPA fallback, domain + SSL) | 4–8 |
| 5 | Payments end-to-end in **sandbox → live**: inbound (Stripe/PayPal customer payments, buy-credit) and partner payouts through the approval queue | 10–15 |
| 6 | Survey loop live test: BitLabs postback → credit → signal ingest → agent trigger → oversight queue | 6–10 |
| 7 | Mobile wrapper (Capacitor Android first) + store submission prep | 15–22 |
| 8 | QA pass + fixes (auth, store, referrals, legal pages) | 10–15 |
| **Total** | | **66–102** |

**To stay under 100 with certainty, two scope calls (recommended):**
- **Ship Android first, iOS 2–4 weeks post-launch** (−6–10h now; iOS review is slower anyway).
- **Launch with the in-process queue** (already built; SQS worker swap is documented for when scale demands it) and **defer the full load test** until real traffic justifies it (−10–15h). The AWS scaling doc + load-test plan are ready whenever needed.

With those two calls: **~70–95 hours to launch.**

## What makes this credible (not padded)
- The frontend **build is already verified green** — the #1 source of surprise debugging is gone.
- Every integration's env var is enumerated in `CONFIG-AND-SECRETS.md`; nothing has to be discovered.
- Security/economy hardening is done — the dev isn't asked to design money-handling, only to deploy and test it.
- The remaining unknowns are provider-side (key approvals, store review), and those are wait-time, not build-time.

> Hand this file + `DEVELOPER-HANDOFF-BRIEF.md` to your developer as the working scope. Anything they're asked to add beyond this list is scope creep against the 100-hour target.
