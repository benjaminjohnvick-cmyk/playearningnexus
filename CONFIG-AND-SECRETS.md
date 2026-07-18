# PlayEarning Nexus — Configuration, API Keys & Auth Inventory

## Summary — no secrets are stored in the code
I scanned the entire codebase (`src/` and `base44/`) for hardcoded secrets, API keys, tokens, and credentials. **None are present**, and there are no `.env` files in the export. This is the correct, secure design: every secret is read at runtime from an environment variable, and the actual *values* live in Base44's backend secret manager — not in the repo. So there is nothing sensitive to "pull" from the file; there is only the **list of keys the app expects you to configure**, below.

The only concrete identifiers present in the file are non-secret:
- `VITE_BASE44_APP_ID = cbef744a8545c389ef439ea6` (public app identifier, in README example)
- `VITE_BASE44_APP_BASE_URL = https://my-to-do-list-81bfaad7.base44.app` (README example)

## Backend secrets the app expects (set these in Base44 → backend env/secrets)
Read via `Deno.env.get(...)` inside `base44/functions/*`. Values are NOT in the code.

| Env var | Used for | # of functions |
|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET_KEY` | PayPal payouts & orders | 9 |
| `STRIPE_SECRET_KEY` | Stripe payments | 8 |
| `BITLABS_API_KEY` | BitLabs survey provider | 5 |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS notifications | 4 |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Twitter/X posting | 4 |
| `APP_URL` | Absolute links in emails/webhooks | 4 |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth & posting | 3 |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Instagram posting | 2 |
| `SCRAPINGBEE_API_KEY` | Web scraping (competitive intel) | 2 |
| `BROWSERLESS_API_KEY` | Headless browser tasks | 2 |
| `SNAPCHAT_CLIENT_ID` / `SNAPCHAT_CLIENT_SECRET` | Snapchat integration | 1 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notifications | 1 |
| `PAYOUT_WEBHOOK_URL` / `PAYOUT_WEBHOOK_SECRET` | Payout webhook verification | 1 |

## Frontend public config (safe to expose — build-time `import.meta.env.VITE_*`)
| Env var | Purpose |
|---|---|
| `VITE_BASE44_APP_ID` | Base44 app id |
| `VITE_BASE44_APP_BASE_URL` | Base44 backend URL |
| `VITE_BASE44_FUNCTIONS_VERSION` | Functions version pin |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable (public) key |
| `VITE_PAYPAL_CLIENT_ID` | PayPal client id (public) |
| `VITE_VAPID_PUBLIC_KEY` | Web push public key |

## Base44-managed integrations (no key needed in your code)
These run through Base44's platform credentials via `base44.integrations.Core.*`:
`InvokeLLM`, `GenerateImage`, `GenerateSpeech`, `SendEmail`, `UploadFile`.

## Recommendations
1. **Set the backend secrets in Base44's secret manager**, not in any committed file. Keep `.env` gitignored (it already is).
2. **Never commit real values** — do not paste live keys into this repo, a Claude project doc, or a chat. If a real key ever lands in the repo, rotate it.
3. Publishable/public keys (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYPAL_CLIENT_ID`, VAPID public) are safe in the frontend build by design.
