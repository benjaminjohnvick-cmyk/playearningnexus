# GamerGain / PlayEarning Nexus — Configuration, API Keys & Auth Inventory
### Self-hosted stack (Base44 removed)

## Summary — no secrets are stored in the code
No hardcoded secrets, API keys, or credentials live in the repo — every secret is read at runtime
from an environment variable. On the **self-hosted** stack the values live in **your backend host's
environment (or a `.env` file / secrets manager)** — never in the repo, and never in the frontend
bundle. This doc is the **list of keys you configure**.

Two places hold config:
- **Backend** (`/backend`, Deno) — reads secrets via `Deno.env.get(...)`. Set these in your host's
  env or `backend/.env` (git-ignored).
- **Frontend** (React/Vite) — public, build-time `import.meta.env.VITE_*` values in `.env.local`.

## Backend secrets — set in your backend host's env / `backend/.env`
### Core (self-hosted platform)
| Env var | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (e.g. Neon/Supabase/RDS) — **required** |
| `AUTH_JWT_SECRET` | Signs user JWTs — **required**, use a long random string |
| `FRONTEND_URL` | Builds password-reset links |
| `CORS_ORIGIN` | Your frontend domain |

### AI / email / images (formerly free via Base44 — now YOUR provider keys)
| Env var | Used for |
|---|---|
| `OPENAI_API_KEY` *(or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic`)* | `InvokeLLM`, agent runtime, `GenerateImage`, `GenerateSpeech` |
| `SENDGRID_API_KEY` *(or `EMAIL_PROVIDER=ses` + AWS keys, or `=smtp`)* | `SendEmail`, password-reset & invite emails |
| `EMAIL_FROM` | From-address for outbound email |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` | `UploadFile` → S3 |
| `GOOGLE_CLIENT_ID` | Verifies "Sign in with Google" |

### Your existing app integrations (unchanged)
| Env var | Used for |
|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET_KEY` | PayPal payouts & orders |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `BITLABS_API_KEY` | BitLabs survey provider |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Twitter/X posting |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth & posting |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram posting |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Snapchat |
| `SCRAPINGBEE_API_KEY` / `BROWSERLESS_API_KEY` | Competitive-intel scraping |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push |
| `PAYOUT_WEBHOOK_URL` / `PAYOUT_WEBHOOK_SECRET` | Payout webhook verification |
| `APP_URL` | Absolute links in emails/webhooks |

> Full annotated list with defaults: `backend/.env.example`.

## Frontend public config — `.env.local` (safe to expose; build-time `VITE_*`)
| Env var | Purpose |
|---|---|
| `VITE_NEXUS_API_URL` | **Your backend URL** (replaces the old Base44 app id/base url) |
| `VITE_GOOGLE_CLIENT_ID` | Enables the "Continue with Google" button (optional) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable (public) key |
| `VITE_PAYPAL_CLIENT_ID` | PayPal client id (public) |
| `VITE_VAPID_PUBLIC_KEY` | Web push public key |
| `VITE_LOGIN_URL` *(optional)* | Login route (default `/login`) |

> The old `VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL` / `VITE_BASE44_FUNCTIONS_VERSION` are
> **gone** — there's no Base44 to point at. Just set `VITE_NEXUS_API_URL`.

## What changed vs the Base44 version
- Secrets used to live in **Base44's secret manager**; now they live in **your backend host's env**.
- `InvokeLLM` / `GenerateImage` / `GenerateSpeech` / `SendEmail` / `UploadFile` used to run free on
  **Base44's platform credentials**; now they use **your own** OpenAI/Anthropic, SendGrid/SES, and S3
  keys (this is the real cost driver — budget for LLM usage especially).
- Auth used to be Base44-hosted; now it's **your JWT + optional Google**, so you also set
  `AUTH_JWT_SECRET` and (optionally) `GOOGLE_CLIENT_ID`.

## Recommendations
1. Set backend secrets in your **host's env or a secrets manager**, never in a committed file. Keep
   `backend/.env` git-ignored (it is).
2. **Never commit real values** — not to the repo, a Claude project doc, or a chat. If a real key
   ever lands in the repo, rotate it.
3. Publishable/public keys (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYPAL_CLIENT_ID`, VAPID public)
   are safe in the frontend build by design.
