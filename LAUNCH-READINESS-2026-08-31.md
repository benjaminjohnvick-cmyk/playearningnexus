# Global Launch Readiness — verified 2026-08-31

This is an honest status, not a victory lap. It separates **what is engineering-complete and verified
green today** from **what only you, your counsel, or a vendor can close.** No one — including me — can
truthfully certify "100% ready to launch" while the second list is open, because those gates live
outside the code.

---

## A. Verified GREEN today (I ran these)

| Check | Command | Result |
|---|---|---|
| Structural audit (1,151 backend files, 932 functions) | `node deploy-kit/audit.mjs` | **PASS — 0 advisories** |
| Production web build | `npx vite build` | **PASS — 8.4 MB dist, per-page code-split** |
| Lint | `npx eslint . --quiet` | **PASS — 0 errors** |
| Cash-out compliance guard on every payout rail | manual + audit | **PRESENT on all 6 rails** |
| Env/config readiness | `node deploy-kit/env-check.mjs` | code ready; 4 secrets to set (below) |

**Cash wall — the most important line — is intact.** All six cash-disbursement functions
(`paypalPayout`, `cashappPayout`, `venmoPayout`, `processRewardPayout`, `respondentMicroPayout`,
`processMonthlyAffiliatePayouts`) route through `cashDisbursementHold()`, which enforces **both** the
`cash_out` operational kill-switch **and** the `CASH_OUT_LEGAL_SIGNOFF` legal hold before any money
leaves. Regular users remain closed-loop (on-site credit only); only verified business partners can be
paid, and only when both switches are clear. I also fixed the auditor so it recognizes this helper — it
was emitting 6 false-positive warnings that could have hidden a real future gap. The audit is now
truly clean-green.

## B. Could NOT run in this sandbox (not a code problem — a sandbox network limit)

- **Backend unit tests** (`deno test backend/sdk/`) — 32 test files. They import `deno.land/std`
  assertions over the network, which this sandbox blocks. They run in your real CI where deno.land is
  reachable. I verified the suite is present and the code around it builds/audits clean, but I cannot
  claim a green test run I didn't execute.
- **Runtime smoke tests** (`node deploy-kit/go-live.mjs`) — these hit a *live* backend on
  `localhost:8000`. Nothing is deployed here, and the Deno backend can't boot in this sandbox (same
  network wall on its Postgres driver import). This is a deploy-time gate: run it once against your
  deployed backend and it exercises signup → login → auth → entities → store → payout → KYC → the
  Premium-PPC surfaces.

## C. Only YOU can close these (accounts, keys, config — not code)

**Deployment secrets (4, required to boot):**
`DATABASE_URL`, `AUTH_JWT_SECRET`, `S3_BUCKET` (image uploads fall back to inline if unset), `APP_URL`.
See `CONFIG-AND-SECRETS.md`. Schema auto-migrates on first boot.

**Optional API keys** — all have free-tier or fallback paths, so launch does not depend on them:
Groq/OpenAI/Anthropic (LLM), Cloudflare/Bedrock (images), Brevo/SendGrid/SES (email), BitLabs
(surveys), Stripe/PayPal (cards — only needed when you turn card charging on).

**Business/legal setup:** business formation + EIN, DMCA agent registration, W-9 collection + 1099
filing, app-store developer accounts and review (`APP-STORE-SUBMISSION-CHECKLIST.md`), and backend
domain + hosting (`SETUP-RUNBOOK.md`).

## D. Only your COUNSEL can close these (sign-off gates — code stays OFF until then)

The whole compliance design is that sensitive features stay **gated OFF pending counsel.** Launching
"100% on" would violate that design, so this stays a human decision, per switch:

- `card_charging` — card checkout (points work today with no processor).
- `cash_out` + `CASH_OUT_LEGAL_SIGNOFF` — real cash disbursement to partners.
- The model itself: closed-loop non-cashable points, 18+ gate, the earnings-only membership,
  single-tier affiliate model, session-recording disclosure/consent, marketplace framing, backup tax
  withholding, and — **new since the last checklist** — the **localization/culturalization** feature
  (see `LOCALIZATION-CULTURALIZATION-COUNSEL-NOTE.md`): adapting listings, catalog, and promos to each
  market's language and customs raises per-jurisdiction advertising-law and protected-class questions.

Packet for counsel is current: `FOR-YOUR-ATTORNEY.md`, `CURRENT-MODEL-AND-COMPLIANCE-STATE-v2`,
`PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`, and the localization note.

---

## Green-to-launch sequence

1. **Counsel sign-off** on the model + which switches may flip.
2. **Business formation + accounts** (EIN, processor KYC, app-store, DMCA agent).
3. **Set the 4 secrets, deploy the backend** (schema auto-migrates), point the web build at `APP_URL`.
4. **Run `go-live.mjs` against the deployed backend** — confirm all smoke checks pass.
5. **Launch on points** with `card_charging` and `cash_out` **OFF**. This is a real, openable product
   on day one: earn, survey, marketplace (closed-loop credit), all live.
6. **Flip cash rails ON** only once processor + counsel are both done.

**Bottom line:** the code is in launch shape — everything runnable here is green, the compliance wall
holds, and the web app builds. What stands between you and an open global launch is not more code; it's
counsel sign-off, a handful of accounts and secrets, and one deploy-time smoke run. I've done the part
that's mine to do.
