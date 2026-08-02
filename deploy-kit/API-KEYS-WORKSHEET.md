# API Keys Worksheet — fill this in BEFORE the developer starts

Every value the app needs, where to get it, and where it goes. **The owner fills this in** (account
signups are not developer work). Hand the completed sheet to the developer and Phase 1 drops from
8–12h to ~6h. **Never commit real values** — paste them into Railway's Variables UI only.

Legend: **[B]** = backend service variable (also give to the scheduler service) · **[F]** = frontend
build variable (`VITE_*`, public) · **required** = app won't run without it.

## Core platform (required)
| Variable | Where to get it | Your value |
|---|---|---|
| `DATABASE_URL` **[B]** required | Railway Postgres service → Variables (auto-created) | `____________________` |
| `AUTH_JWT_SECRET` **[B]** required | Generate a long random string: `openssl rand -base64 48` | `____________________` |
| `APP_URL` **[B]** required | Your frontend domain (e.g. https://gamergain.app) | `____________________` |
| `FRONTEND_URL` **[B]** | Same as APP_URL (used for password-reset links) | `____________________` |
| `CORS_ORIGIN` **[B]** | Your frontend domain | `____________________` |
| `VITE_NEXUS_API_URL` **[F]** required | Your backend domain (Railway-generated or custom) | `____________________` |

## AI / email / images — the FREE stack (all $0 on free tiers; each falls back if unset)
Fastest path: run `npm run setup` (the terminal wizard fills these in for you). All optional — the app
runs without them, just on a paid fallback path.
| Variable | Where to get it (FREE) | Your value |
|---|---|---|
| `GROQ_API_KEY` **[B]** | console.groq.com → API keys. Powers ALL AI + speech-to-text at $0. Falls back to OpenAI. | `____________________` |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` **[B]** | dash.cloudflare.com → Workers AI token. Free image generation. Falls back to Bedrock/Titan. | `____________________` |
| `BREVO_API_KEY` **[B]** | brevo.com → SMTP & API. Free ~9k emails/mo (set `EMAIL_PROVIDER=brevo`). Or use SES with AWS creds. | `____________________` |
| `EMAIL_FROM` **[B]** required | A verified sender for your email provider | `____________________` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` **[B]** | AWS IAM user — enables SES email, Polly voice (free 5M/mo yr 1), and S3 uploads | `____________________` |
| `REDIS_URL` **[B]** optional | Railway Redis — shares the TTS/translation cache across instances (bigger savings) | `____________________` |
| `OPENAI_API_KEY` **[B]** optional | platform.openai.com — only a fallback now; Groq is the default | `____________________` |
| `GOOGLE_CLIENT_ID` **[B]** + `VITE_GOOGLE_CLIENT_ID` **[F]** | console.cloud.google.com → OAuth 2.0 Client (optional; Google sign-in) | `____________________` |

## Payments (required for money features)
| Variable | Where to get it | Your value |
|---|---|---|
| `STRIPE_SECRET_KEY` **[B]** | dashboard.stripe.com → Developers → API keys (test first, then live) | `____________________` |
| `VITE_STRIPE_PUBLISHABLE_KEY` **[F]** | Stripe → publishable key | `____________________` |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET_KEY` **[B]** | developer.paypal.com → Apps & Credentials | `____________________` |
| `VITE_PAYPAL_CLIENT_ID` **[F]** | PayPal client id (public) | `____________________` |

## Surveys, SMS, push, scraping (feature-dependent)
| Variable | Where to get it | Your value |
|---|---|---|
| `BITLABS_API_KEY` **[B]** | bitlabs.ai dashboard (survey provider) | `____________________` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` **[B]** | twilio.com console (SMS) | `____________________` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` **[B]** + `VITE_VAPID_PUBLIC_KEY` **[F]** | Generate: `npx web-push generate-vapid-keys` | `____________________` |
| `SCRAPINGBEE_API_KEY` / `BROWSERLESS_API_KEY` **[B]** | scrapingbee.com / browserless.io (competitive intel — optional) | `____________________` |
| Social posting: `TWITTER_*`, `FACEBOOK_*`, `INSTAGRAM_*`, `SNAPCHAT_*` **[B]** | Each platform's developer portal (optional) | `____________________` |

> Full annotated list with defaults lives in `backend/.env.example`. Anything not set simply disables
> that feature gracefully — start with the required rows, add the rest as you turn features on.
