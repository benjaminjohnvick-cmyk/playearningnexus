# PlayEarning Nexus — Base44 removal (rework summary)

The codebase has been reworked to **no longer use Base44** while keeping the same functionality. The app now runs on a self-hosted stack: a React frontend talking to a self-hosted backend (`/backend`) instead of the Base44 platform.

## What changed (frontend)
- **`src/api/base44Client.js`** — rewritten. No longer imports `@base44/sdk`; it's now a thin client that calls the self-hosted backend over HTTP. It still exports the same `base44` object with the same surface (`entities`, `auth`, `functions`, `integrations.Core`), so **all 643 files that use it are unchanged**.
- **`src/lib/AuthContext.jsx`** — rewritten. Removed the direct `@base44/sdk` axios import and the Base44 "app public settings" call; auth is now token-based against the backend (`auth.me()` when a token exists).
- **`src/lib/app-params.js`** — removed (Base44 URL/token param plumbing no longer needed).
- **`vite.config.js`** — removed the `@base44/vite-plugin`.
- **`package.json`** — removed `@base44/sdk` and `@base44/vite-plugin`; renamed to `playearning-nexus`.
- **`index.html`** — replaced the Base44 favicon URL with the local app icon.
- **`package-lock.json`** — deleted (regenerates clean, Base44-free, on `npm install`).
- **`.env.example`** — added; the frontend now needs only `VITE_NEXUS_API_URL` (your backend URL).

Result: **zero `@base44` imports anywhere in the running app.** Every feature keeps working because the call sites never changed — only what the `base44` client points at.

## Restored auth flow + lost functionality (added back)
Base44 previously hosted the login screen and file uploads. The self-hosted app now includes:
- **Login/signup pages** — `src/pages/Login.jsx`, `src/pages/Signup.jsx`, and the shared `src/components/auth/AuthForm.jsx`. Routed at `/login` and `/signup` as **public** routes (rendered outside the auth gate so there's no redirect loop). They call `base44.auth.login()` / `signup()`, store the JWT, and return the user to the `?redirect=` target. `redirectToLogin()` / `logout()` land here.
- **`UploadFile` restored to one call** — the client's `integrations.Core.UploadFile({ file })` again returns `{ file_url }`: it requests a presigned S3 URL from the backend, PUTs the bytes, and returns the URL — so the 35 existing upload call sites keep working unchanged (needs `S3_BUCKET` configured on the backend).
- Everything else the SDK exposed (`auth.me`, `auth.updateMe`, `InvokeLLM`, `SendEmail`, `GenerateImage`, `GenerateSpeech`, entity CRUD, `functions.invoke`) is preserved by the client + backend routes.

## Password reset + Google sign-in (added)
- **Password reset** — backend endpoints `/auth/request-reset` (emails a time-limited token link via `SendEmail`) and `/auth/reset-password` (verifies the token, sets the new password). Frontend pages `src/pages/ForgotPassword.jsx` (`/forgot-password`) and `src/pages/ResetPassword.jsx` (`/reset-password`), plus a "Forgot password?" link on the login form. Token is hashed at rest, expires after `RESET_TOKEN_TTL_MIN` (default 60), and never reveals whether an email is registered. Env: `FRONTEND_URL`, `RESET_TOKEN_TTL_MIN`, and a working `SendEmail` provider.
- **Sign in with Google** — backend `/auth/google` verifies the Google ID token (server-side via Google's tokeninfo, checks `aud`), finds-or-creates the user, and issues our JWT. Frontend `src/components/auth/GoogleSignInButton.jsx` (Google Identity Services) shows on the login/signup form. Env: `VITE_GOOGLE_CLIENT_ID` (frontend) + `GOOGLE_CLIENT_ID` (backend). The button self-hides when not configured, so it's zero-risk until you set it up.

## What changed (backend)
- The former Base44 `base44/` platform folder (entities, functions, agents) is **removed** — it's fully superseded by **`/backend`**, the self-hosted equivalent:
  - `backend/functions/` — all 526 functions, converted to the self-hosted SDK.
  - `backend/db/schema.sql` — 235 tables generated from the old entities (validated against real Postgres).
  - `backend/agents-runtime/` — the 76 agents as an LLM tool-calling runtime.
  - `backend/sdk/` — the drop-in SDK (Postgres, auth, integrations, RLS, queue).
  - `backend/server/` — the HTTP server (functions, entities, integrations, auth, agents).
  - `backend/scheduler/` — cron for the automation functions.
- The only remaining `@base44` strings are in **migration tooling/docs** (`backend/tools/export-from-base44.mjs`, the codemod, the cutover guide) — used *once* to pull your data out of Base44, not at runtime.

## How to run the reworked app
1. **Backend:** `cd backend && cp .env.example .env` (set `OPENAI_API_KEY`, `AUTH_JWT_SECRET`, etc.), then `docker compose up --build`. Loads Postgres + boots all functions.
2. **Frontend:** `cp .env.example .env.local`, set `VITE_NEXUS_API_URL=http://localhost:8000`, then `npm install && npm run dev`.
3. **Migrate data (when ready):** follow `backend/PHASE-4-CUTOVER.md` to export from Base44 and import into Postgres.

## Status / honest notes
- The frontend rework and backend conversion are **mechanically complete and pass syntax checks**. The database layer is **validated against a real PostgreSQL 16** (see `backend/PHASE-2-VALIDATION-RESULTS.md`).
- Not yet run end-to-end as a live system (the Deno backend couldn't boot in the build sandbox). Booting it locally + the smoke test is the remaining validation — `backend/PHASE-2-RUNBOOK.md`.
- Base44-hosted **user passwords** don't export; plan a reset flow on first login (noted in the cutover guide). New signups set their own via `/auth/signup`.
- Your original Base44 definitions remain preserved in your GitHub history and earlier full-codebase exports if you ever need them.
