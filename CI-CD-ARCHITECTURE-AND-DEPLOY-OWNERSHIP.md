# CI/CD Architecture & Deploy Ownership

_Last updated: 2026-09-23 (session with Ben). Records who owns the deploy and what GitHub Actions does
now, so a future session does not re-derive it from a pile of red/green runs. Non-secret only._

## The one-line summary

**Railway owns the deploy. GitHub Actions only validates and smoke-tests.** There is no CLI deploy in
Actions anymore. A push to `main` triggers two independent things: Railway rebuilds the services from
the repo, and GitHub Actions runs `validate` + `smoke`. They do not depend on each other.

## Who deploys what

- **Railway (native GitHub integration)** is the deploy. On every push to `main`, Railway auto-builds and
  redeploys its services directly from GitHub — no token, no CLI, no Actions step involved:
  - **`getgreen`** — the frontend/website. Builder = Dockerfile at `deploy-kit/railway/frontend.Dockerfile`,
    root = repo root. Public URL: https://getgreen-production.up.railway.app
  - **`playearningnexus`** — the Deno backend. Root Directory = `backend`. Public URL:
    https://playearningnexus-production.up.railway.app
  - (Project `passionate-presence`, environment `production`.)
- **base44 platform** migrates scheduled automations/workflows (the `base44-builder` bot commits such as
  "Migrated N workflow(s)"). Unrelated to Railway/Actions health.

## What GitHub Actions runs (`Deploy (CI/CD)` = `.github/workflows/deploy.yml`)

Two jobs only:

1. **Validate build + audit** — `bash deploy-kit/validate.sh` (vite build + entity/scheduler/manifest
   audit) then `node deploy-kit/audit.mjs`. Fails fast if anything drifted.
2. **Automated QA smoke (live)** — `needs: validate`; runs `deploy-kit/e2e-smoke.mjs` only if the
   `BACKEND_URL` Actions variable is set (skips with a notice otherwise, never hard-fails).

The old **"Deploy backend to Railway"** job (`railway up` CLI) was **removed** on 2026-09-23 (commit
`ab756442`). Reason: it duplicated Railway's own GitHub integration, double-built the service, and could
not succeed as written — it ran from `working-directory: backend`, so it uploaded only `backend/` while
the `getgreen` service builds `deploy-kit/railway/frontend.Dockerfile` at the repo root. That mismatch is
what produced `Service not found` and then `The configured root directory was not found in the deployed
source`. Deleting the job is correct: Railway already deploys, so Actions should not.

Consequence: the `RAILWAY_TOKEN` secret and `RAILWAY_SERVICE` variable are **no longer used** by any
workflow. They can be deleted from GitHub → Settings → Secrets and variables → Actions, or left (harmless).

## Other workflows

- **`android-build.yml` ("Android Build & Play")** — `workflow_dispatch` (manual) only. It does **not**
  run on push. Run it by hand from the Actions tab when you want an `.aab`. With no signing secrets it
  still produces a downloadable UNSIGNED `.aab`; add `ANDROID_KEYSTORE_*` (and optionally
  `PLAY_SERVICE_ACCOUNT_JSON`) for a signed build / auto-publish.
- **`ios-build.yml` ("iOS Build & TestFlight")** — runs on push to the `ios-release` branch, plus manual.
- **`ota-mobile.yml` ("Mobile OTA publish")** — runs on push to `main` touching `src/**`; the actual OTA
  push is gated behind a `CAPGO_TOKEN` secret (skips gracefully without it).

## Gotcha fixed 2026-09-23: `secrets` is not allowed in an Actions `if:`

`android-build.yml` had `if: ${{ ... && secrets.PLAY_SERVICE_ACCOUNT_JSON != '' }}` on the Play-publish
step. The `secrets` context is **not permitted inside an `if:` expression**, which makes the **entire
workflow file invalid**. GitHub then rejected the file on **every push** and posted an instant failed run
(the "-1s" / "0s, no jobs" signature) — regardless of the `workflow_dispatch`-only trigger. That was the
source of the recurring red Android runs, not the trigger and not a real build failure.

Fix (commit lands 2026-09-23): probe the secret in a `run` step (where `secrets` IS allowed, via `env`)
that writes a `ready` output, and gate the publish step on `steps.play.outputs.ready == 'true'` instead of
referencing `secrets` in the `if:`. This mirrors the existing keystore guard. General rule for this repo:
**never reference `secrets.*` in an `if:` — expose it through `env:` in a `run` step and test the flag.**

## The bug that started the 2026-09-23 session (for context)

The original red builds in Ben's GitHub error export traced to a **missing file**, `src/lib/app-params.js`
(imported by `src/pages/OAuthConsent.jsx`), which broke `vite build` and thus both the Actions validate job
and Railway's frontend build. Adding the file back (commit `60697892`) fixed the real failure. Everything
after that (token, service name, removing the CLI deploy, the Android `if:` fix) was cleanup of redundant
or misconfigured CI, not the live site — which kept deploying green via Railway throughout.

## How to verify any future deploy

After a push: fetch `https://playearningnexus-production.up.railway.app/health?deep=1` and confirm
`commit` is the new SHA and `db` is `true`. That proves the live deploy independently of any dashboard.
GitHub Actions "Deploy (CI/CD)" going green proves the build + audit + smoke; it does **not** deploy.
