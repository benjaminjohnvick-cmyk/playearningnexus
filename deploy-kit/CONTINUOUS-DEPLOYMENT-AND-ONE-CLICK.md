# Continuous Deployment, One-Click Deploy & the No-Terminal Wizard

_How to run the execution kit **automatically** (push → deploy) and how a **non-coder** can do it by hand
without a terminal. Honest boundary up front: everything on your infrastructure can be automated; the
steps that live outside it — creating accounts, entering your own card/keys, and passing Apple/Google
review — are irreducibly human and are the same for everyone._

## The three ways to deploy (pick one)

### A. Automatic — push to deploy (continuous deployment)
`.github/workflows/deploy.yml` runs on every push to `main`:
1. **Validate** — builds the frontend and runs the full pre-deploy audit (entities↔schema,
   scheduler↔functions, manifest). Fails fast if anything drifted.
2. **Deploy** — deploys the backend to Railway.
3. **Smoke** — runs the automated QA pass against the live backend.

**One-time setup** (GitHub → *Settings → Secrets and variables → Actions*):
- Secret **`RAILWAY_TOKEN`** — a Railway token (Railway → account → *Tokens*). Enables auto-deploy.
- Variable **`RAILWAY_SERVICE`** — backend service name (optional; defaults to `backend`).
- Variable **`BACKEND_URL`** — your live backend URL (optional; turns on the post-deploy smoke test).

Until you add `RAILWAY_TOKEN`, the workflow still validates every push and simply **skips** deploy/smoke
with a notice — it never hard-fails. After you add it, **every push deploys itself.** Nothing in this
pipeline can charge a card or move money.

> Even simpler alternative: in the Railway dashboard you can *connect the GitHub repo* to a service, and
> Railway auto-deploys on every push with no workflow at all. Use whichever you prefer — the workflow
> gives you the validation + QA gates; the dashboard connection is the least setup.

### B. One-click — the Deploy on Railway button
The repo README has a **[Deploy on Railway]** button. A non-coder clicks it, signs in to Railway, and
Railway imports this repo. Then, in the new project:
1. Add a **PostgreSQL** database (*+ New → Database → PostgreSQL*). Railway wires `DATABASE_URL` in for you.
2. On the backend service, set **Root Directory = `backend`** — it auto-reads `backend/railway.json`
   (Dockerfile build, `/health` check, restart policy).
3. Paste your keys into the service **Variables** — generate them with the wizard (below).

That replaces the entire "deploy the backend" phase with clicks. (A fully pre-wired one-click — Postgres
auto-attached and variables pre-filled — requires publishing this as a Railway *template* once through
their site; the button + `railway.json` gets you 90% there without it.)

### C. By hand — the no-terminal wizard
Open **`deploy-kit/wizard/index.html`** by double-clicking it (it's a normal web page — no install, no
server). It runs entirely in your browser and **sends nothing anywhere**. You:
- paste your API keys (with a one-click generator for the auth secret),
- click **Generate**, and it produces your complete config (a `.env` download + copy button) with every
  non-key setting already pre-filled to the launch defaults,
- follow the on-page click-path: Deploy on Railway → add Postgres → paste the config → done.

No editing text files, no running scripts.

## Phone apps (also push-triggered)
`.github/workflows/android-build.yml` and `ios-build.yml` build and sign the apps in the cloud (no Mac,
no Android Studio). They run when you click **Run workflow** in the Actions tab, or when you push to the
`android-release` / `ios-release` branch. Add the signing secrets listed at the top of each workflow
once. A non-coder who uploads code through GitHub's website gets the builds by pushing to those branches.

## What is still human (for everyone — agent or not)
- **Create the accounts** (Railway, Apple $99/yr, Google Play $25, OpenAI/Anthropic, SendGrid) and enter
  your own payment info and keys. These have verification + billing behind them by design.
- **Accept each service's terms**, and grant OAuth where asked. A script should not click these for you.
- **Pass Apple/Google app-store review**, and respond to any rejection. No automation decides their review.
- **Legal review** of the privacy/terms and the PPC/advertising model (see the lawyer packet).

Everything mechanical between those human steps now runs on its own.

## Files in this feature
- `.github/workflows/deploy.yml` — the CD pipeline (validate → deploy → smoke).
- `backend/railway.json` — the backend service config Railway reads.
- `README.md` — the Deploy on Railway button + quickstart.
- `deploy-kit/wizard/index.html` — the no-terminal setup wizard.
- `.github/workflows/android-build.yml` / `ios-build.yml` — push-triggered mobile builds.
