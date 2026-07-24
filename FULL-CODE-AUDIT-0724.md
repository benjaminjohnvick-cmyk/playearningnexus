# Full Code Audit — GamerGain / PlayEarning Nexus (2026-07-24)

Static audit of the entire codebase **without a build or sandbox on your machine**, run
inside the cloud workspace using real tooling: the TypeScript compiler (`tsc`) over all
565 backend `.ts` files, ESLint over all 842 frontend `.js/.jsx` files, plus a custom
security-pattern battery (secrets, injection, XSS, weak crypto, CORS, non-TLS, auth
precedence). ~230,000 lines scanned.

## Headline result
The codebase is in good shape structurally: **zero parse/syntax errors** across the whole
frontend, and no build-breaking syntax errors in the backend (the 4,175 `tsc` "property
does not exist" notices are false positives from the dynamic SDK proxy, which resolves at
runtime in Deno; the 7 "cannot find module" are valid Deno `npm:`/`https:` imports `tsc`
doesn't understand). But the scan surfaced **10 real bugs — including one SQL-injection
vector and one auth bypass — all now fixed.**

## Fixed in this pass

### Security
1. **SQL injection via filter keys / sort field (HIGH).** `backend/sdk/db.ts` built
   `data->>'<key>'` by interpolating the JSONB key and sort field directly into SQL. Those
   come from the request body with no allowlist, so a crafted key containing a single quote
   could break out of the string literal. Fixed by escaping keys/fields (`jsonKey()`) and
   hardening identifier quoting (`quoteCol`/`quoteTbl` now escape embedded quotes). Values
   were already parametrized (`$1`); the table name is regex-limited at the route, so that
   path was not reachable.
2. **Auth bypass on an admin endpoint (HIGH).** `aiChurnPredictionEngine` used
   `if (!user?.role === 'admin')`, which is `(!user?.role) === 'admin'` → always false, so
   the 403 never fired and any caller could run it. Fixed to `user?.role !== 'admin'`.

### Correctness (crashes / wrong behavior)
3. **Admin page rendered for everyone.** `DisputeAutoApprovalSettings.jsx` had the same
   `!user?.role === 'admin'` precedence bug on its access guard. Fixed.
4. **Three admin dashboards never loaded data.** `SurveyAdminDashboard.jsx` and
   `RealtimeFraudMonitorDashboard.jsx` (×3) used `enabled: !!user?.role === 'admin'`
   (always false), so their React-Query fetches never ran. Fixed to `user?.role === 'admin'`.
5. **Runtime crash — undefined variable.** `generateAIDailyGoal` referenced
   `maxDailyEarningsDay` (never declared; the real var is `maxEarningsDay`) — a ReferenceError
   when building the prompt. Fixed.
6. **Runtime crash — undefined shorthand in email templates.** `triggerEmailMarketing` wrote
   `${{earnings_this_week}}` and `${{avg_monthly_earnings}}` inside template literals, which JS
   parses as interpolating an object referencing undeclared variables → ReferenceError. Escaped
   the `$` so they render as literal `{{…}}` mustache placeholders.
7. **Latent crash in error handler.** `autoAdminOpsEngine` declared `results`/`errors` inside
   the `try`, but the outer `catch` referenced `errors` — out of scope, so an error there would
   throw a second ReferenceError and mask the original. Hoisted both declarations.

## Reviewed and confirmed NOT bugs
- `eval` / `new Function` and raw SQL string-building appear only in `backend/tools/e2e/*`
  and `shadow-compare.mjs` — dev-only test harnesses, never shipped to the request runtime.
- `http://internal/…` URLs are the in-process function-invocation router; they never touch
  the network.
- `Math.random()` for `visitorId` in `surveyWidget` is a non-security tracking id — fine.
- `Access-Control-Allow-Origin: *` exists only on `surveyWidget`, which is a public embeddable
  widget — intended.
- `base44.appLogs` (frontend) is defined in the self-hosted client shim — safe.
- The `earningVelocityMonitor` `action !== 'allow'` comparison is redundant (action is only
  ever `block`/`flag`) but the result is correct — left as-is.
- `chart.jsx` `dangerouslySetInnerHTML` is the standard shadcn/ui chart-CSS injection — safe.
- No hardcoded live secrets (Stripe live keys, GitHub tokens, AWS keys, private keys) anywhere.

## Still open — recommend addressing (NOT auto-changed)
- **XSS review on `dangerouslySetInnerHTML`.** Three spots render HTML that may include
  user/partner input without sanitization: `AdCreativeStudio.jsx` (advertiser `overlayText`),
  `ReconciliationPanel.jsx` (`summary_html`), `ReferralOnboarding.jsx` (`step.content`). If any
  of that content is user-derived, sanitize it (e.g. DOMPurify) before injecting.
- **Card payment not verified server-side.** In `placeStoreOrder`, the `credit_card` path
  trusts the client's `paypal_order_id` and creates the order without a server-side
  capture/verify — a tampering gap in the closed-loop economy.
- **Per-function auth coverage.** The two precedence bugs above hint that some `asServiceRole`
  functions may lack an admin/user check entirely. A static scan can't judge intent per
  endpoint; a semantic review (agent-per-function) is the right tool if you want that sweep.

## How to re-run this audit yourself
From the repo root, with `tsc` and `eslint` available:
- `tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target esnext --skipLibCheck backend/**/*.ts` (expect SDK-proxy `TS2339` noise; focus on `TS1xxx`, `TS2307` local paths, `TS2552`, `TS18004`, `TS2367`).
- `eslint "src/**/*.{js,jsx}"` with `no-unsafe-negation`, `no-constant-binary-expression`,
  `no-dupe-keys`, `no-unreachable` enabled — catches the `!x === y` class instantly.
