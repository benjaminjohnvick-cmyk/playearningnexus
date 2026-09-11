# API Setup Wizard

Plug-and-play setup guide for provisioning the Get Goods Gratis backend on **Railway**.

## What's here

- **`railway-key-setup.html`** — an interactive, self-contained wizard (open it in any browser). It contains:
  - **All APIs at a glance** — a directory of every third-party service the backend integrates with (13),
    each showing what it powers, its cost, and its status (add-now / live / optional).
  - **Copy-paste raw blocks** — paste straight into Railway → your service → **Variables → Raw Editor**.
  - **Per-API step-by-step guides** — how to create each account, create the app/token, find the exact
    value, and which environment variable it maps to.
  - **Paired feature flags** — e.g. `card_charging`, which must be flipped on after keys are set.
  - **Progress tracking** — checkboxes persist in the browser so you can finish setup across sittings.

## The flow

1. **Gather** — open each API's *Step-by-step* guide and copy the key it names.
2. **Paste** — Railway → your service → **Variables → Raw Editor** → paste a block.
3. **Flip flags** — turn on any paired feature flag (e.g. `card_charging`, after counsel clears money-out).
4. **Self-test** — run the `provisioningSelfTest` backend function; it returns green/red per provider.

## Required vs optional

- **Add now (required to charge cards):** Stripe, PayPal.
- **Already live (free tier, $0):** Groq, Cloudflare Workers AI, Cloudflare R2, Brevo email.
- **Optional levers:** OpenAI/Anthropic (AI fallback), BitLabs (survey wall), Twilio (SMS),
  AWS (alt email/voice/image), product-feed/affiliate, Redis (shared cache), Neon (read replica).

## PayPal secret — one canonical name

The backend reads a single **`PAYPAL_SECRET`** everywhere (SDK + all payout functions). The older
`PAYPAL_SECRET_KEY` is still accepted as a fallback, so existing deployments don't break, but new setups
should set only `PAYPAL_SECRET`.

> Payments are counsel-gated and must be entered by the owner. No credential is stored in the database.
> Variable names, sources, and flags in the wizard are taken from the live codebase
> (`setupStatus`, `paypal-api.ts`, `.env.example`, and the payment/payout functions).
