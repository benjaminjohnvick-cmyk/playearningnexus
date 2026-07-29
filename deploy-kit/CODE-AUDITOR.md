# Automated Code Auditor

_An always-on auditor that FINDS whole classes of problems every push, and safely auto-fixes only the
mechanical ones. Honest by design: it does not silently rewrite money or logic code — and it does not
(and cannot) "guarantee 100% error-free," because no tool can. What it guarantees is that the classes of
bug we've already found can't quietly come back._

## Why it can't promise "zero errors"

No tool can certify an arbitrary program correct — that's a proven limit (undecidability), but the
practical reason matters more: most real "errors" are only wrong relative to what you *intended* (a payout
to the wrong party, a discount that's too generous, a rule that should apply but doesn't). A linter can't
read intent. So this auditor does the achievable, valuable thing: it catches **known, well-defined
failure classes** deterministically, and **flags suspicious patterns** for a human/AI to judge.

## What it does

Run: `node deploy-kit/audit.mjs` (or the fuller `bash deploy-kit/audit.sh`). It runs automatically on
every push via `.github/workflows/deploy.yml`, and inside `deploy-kit/launch.sh`.

**STRUCTURAL checks — deterministic, zero false positives → these FAIL the build:**
- Bracket/paren + string balance for every backend `.ts` file (regex-literal aware).
- JSON validity: `_manifest.json`, `entities.json`, `schedules.json`, `railway.json`.
- Every entity in `entities.json` has a `CREATE TABLE` in `schema.sql` (the launch-blocker class we hit).
- Every scheduled job resolves to a real function.
- Every manifest entry has an `entry.ts`, and every function on disk is registered (else it won't load).

**GUARDRAIL LINTS — heuristic, advisory (may have false positives) → printed for review:**
- Balance/points/`pending_payouts` written via plain `.update()` with no atomic `updateIf` (double-spend risk).
- External cash disbursement (PayPal/Stripe **payouts/transfers**) with no `isEnabled('cash_out')` kill-switch.
- Promotional social-post creation with no `withAdDisclosure()` (FTC `#ad`).
- Direct LLM API calls that bypass the `AI_DAILY_SPEND_CAP_USD` meter in `InvokeLLM`.
- Jackpot/prize/sweepstakes awards missing the 18+ / `featureAllowed('jackpots')` gate.

These are exactly the classes the manual audit found — so the auditor is a **regression net**: reintroduce
one and CI flags it.

## Find vs. fix (the honest line)

- **Finds:** everything above, every push.
- **Auto-fixes (only `bash deploy-kit/audit.sh --fix`):** formatting (`deno fmt`) and lint autofixes
  (`eslint --fix`). Safe, mechanical, no behavior change.
- **Does NOT auto-fix:** money, logic, or compliance issues. Those are reported (with file:line) for a
  human or a *reviewed* AI pass. Silently rewriting payout math or a compliance gate is how you ship a
  money bug — so the auditor deliberately stops at "here's the problem," not "I changed it."

## Flags

- `node deploy-kit/audit.mjs` — find; exit non-zero only on structural errors.
- `node deploy-kit/audit.mjs --strict` — also fail on advisory warnings (flip this on in CI once the
  advisory list is worked down to zero, to hold the line).
- `node deploy-kit/audit.mjs --json` — machine-readable (feed an AI fix pass or a dashboard).
- `bash deploy-kit/audit.sh [--fix] [--strict]` — auditor + Deno type-check + ESLint + optional safe autofix.

## Extending it

Add a new check by appending a pattern to the GUARDRAIL LINTS section of `deploy-kit/audit.mjs` (one
regex + a `warn(file, line, msg)`), or a new structural invariant to the STRUCTURAL section (which `fail()`s
the build). Keep structural checks false-positive-free; keep pattern lints advisory.

## Companion: functional / runtime error-catching

The auditor above is STATIC (it reads the code). For RUNTIME functional errors — broken pages, 500s,
crashed flows — see **`SANDBOX-WALKTHROUGH.md`**: `bash deploy-kit/sandbox-test.sh` spins up a mock-data
sandbox and a headless browser walks every route as the demo user, catching what a person would hit. Same
honest line: it FINDS (with screenshots + a report), it does not auto-fix. Together they cover static +
runtime error-catching in the kit.
