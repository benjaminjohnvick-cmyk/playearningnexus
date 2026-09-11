# API Setup Wizard

Plug-and-play **API-key** setup for the Get Goods Gratis backend on **Railway**. This is the focused
keys-and-providers tool. (Custom domain and deployment live in the companion
`setup-domain-deploy-wizard/` — the go-live superset.)

## What's here

- **`railway-key-setup.html`** — an interactive, self-contained wizard (open it in any browser). It contains:
  - **All APIs at a glance** — a directory of every third-party service the backend integrates with.
  - **Copy-paste raw blocks** — paste straight into Railway → your service → **Variables → Raw Editor**.
  - **Per-API step-by-step guides** — create each account, create the app/token, find the exact value, and which
    environment variable it maps to.
  - **Survey providers (11 networks)** — BitLabs (live) plus CPX, TheoremReach, Pollfish, InBrain, TapResearch,
    Cint, AdGate, ayeT, Revlum, Prodege. Each auto-activates when its API key is set
    (`PROVIDER_<NAME>_ENABLED` defaults on).
  - **Paired feature flags** — e.g. `card_charging`.
  - **Progress tracking** — checkboxes persist in the browser.

## The flow

1. **Gather** — open each API's *Step-by-step* guide and copy the key it names.
2. **Paste** — Railway → your service → **Variables → Raw Editor** → paste a block.
3. **Flip flags** — turn on any paired feature flag.
4. **Self-test** — run `provisioningSelfTest`; green/red per provider.

## Required vs optional

- **Add now (required to charge cards):** Stripe, PayPal.
- **Already live (free tier, $0):** Groq, Cloudflare Workers AI, Cloudflare R2, Brevo email.
- **Survey providers (11):** BitLabs (live) + CPX, TheoremReach, Pollfish, InBrain, TapResearch, Cint, AdGate,
  ayeT, Revlum, Prodege.
- **Optional levers:** OpenAI/Anthropic (AI fallback), Twilio (SMS), AWS (alt email/voice/image),
  product-feed/affiliate, Redis (shared cache), Neon (read replica).

## PayPal secret — one canonical name

The backend reads a single **`PAYPAL_SECRET`** everywhere (SDK + all payout functions). The older
`PAYPAL_SECRET_KEY` is still accepted as a fallback.

> Companion tool: **`setup-domain-deploy-wizard/`** adds custom-domain + deploy on top of everything here.
> Payments are counsel-gated and must be entered by the owner. Variable names, sources, and flags are taken from
> the live codebase (`setupStatus`, `paypal-api.ts`, `survey-providers.ts`, `.env.example`).
