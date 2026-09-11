# Setup, Domain & Deploy Wizard

Plug-and-play go-live guide for the Get Goods Gratis backend on **Railway** — API keys, a custom domain, and
deployment, in one place.

## What's here

- **`setup-domain-deploy-wizard.html`** — an interactive, self-contained wizard (open it in any browser). It
  contains:
  - **Everything at a glance** — a directory of every third-party service the backend integrates with, plus the
    custom-domain & deploy step, each showing what it powers, cost, and status.
  - **Copy-paste raw blocks** — paste straight into Railway → your service → **Variables → Raw Editor**.
  - **Per-API step-by-step guides** — create each account, create the app/token, find the exact value, and which
    environment variable it maps to.
  - **Survey providers (11 networks)** — BitLabs (live) plus CPX, TheoremReach, Pollfish, InBrain, TapResearch,
    Cint, AdGate, ayeT, Revlum, Prodege. Each auto-activates when its API key is set.
  - **Custom domain & deploy** — point your domain at Railway, switch the domain-aware env vars over, and deploy.
  - **Paired feature flags** — e.g. `card_charging`.
  - **Progress tracking** — checkboxes persist in the browser so you can finish across sittings.

## The flow

1. **Keys** — open each API's *Step-by-step* guide and copy the key it names.
2. **Paste** — Railway → your service → **Variables → Raw Editor** → paste a block.
3. **Domain** — point your custom domain at Railway, then switch the domain env vars over.
4. **Deploy & test** — push to `main` (services auto-deploy), then run `provisioningSelfTest`.

## Custom domain & deploy (summary)

The app is already deployed on Railway (project `passionate-presence`; frontend service `getgreen`, backend
`playearningnexus`) and auto-deploys on every push to GitHub `main`. To use your own domain: register a domain
(a purchase you make), add it to the `getgreen` service under **Settings → Networking → + Custom Domain**, add
the CNAME Railway gives you at your registrar's DNS (ALIAS/ANAME or Cloudflare CNAME-flattening for an apex).
**The SSL/TLS certificate is automatic and free** — once DNS resolves, Railway provisions a Let's Encrypt cert
and serves HTTPS (auto-renewing); you never buy a certificate or upload a CSR. (If DNS is proxied through
Cloudflare, its free Universal SSL covers the edge — set SSL/TLS mode to Full (strict).) Then set
`PUBLIC_SITE_URL`, `APP_URL`, `FRONTEND_URL`, `CORS_ORIGIN`
(and optionally `BACKEND_URL` / `VITE_NEXUS_API_URL` if the backend gets its own subdomain, plus
`HLS_PLAYBACK_BASE_URL` for media) to the new domain.

## PayPal secret — one canonical name

The backend reads a single **`PAYPAL_SECRET`** everywhere (SDK + all payout functions). The older
`PAYPAL_SECRET_KEY` is still accepted as a fallback.

> Payments are counsel-gated and must be entered by the owner. The domain purchase and registrar DNS changes are
> the owner's to make. No credential is stored in the database. Variable names, sources, flags and service names
> in the wizard are taken from the live codebase (`setupStatus`, `paypal-api.ts`, `survey-providers.ts`,
> `.env.example`, `RAILWAY-DEPLOY-STATUS.md`).
