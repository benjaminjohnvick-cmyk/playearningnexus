# Automated setup & deploy — no AI/agent required

This is the whole go-live flow as plain commands a human runs in a terminal. No agentic coding, no Claude in
the loop — just Node 18+ and the repo. Everything the app needs falls back gracefully, so it runs even before
you finish, and you can re-run any step any time.

## One-time, in order

```bash
# 0. install deps
npm ci

# 1. Setup Wizard (terminal) — prompts for each key, writes backend/.env, auto-generates secrets.
#    Leave any FREE-tier item blank to keep its $0 fallback; re-run later to add a key.
npm run setup                 # = node deploy-kit/setup.mjs

# 2. Verify every key you entered actually works (pings each provider) + shows the cost-floor readout.
npm run env:check             # = node deploy-kit/env-check.mjs

# 3. Load the database schema into your Postgres (Railway gives you DATABASE_URL).
psql "$DATABASE_URL" -f backend/db/schema.sql
psql "$DATABASE_URL" -f backend/db/seed.sql        # optional starter data

# 4. Run the automatable launch steps (checks keys, generates secrets, validates build, smoke test).
bash deploy-kit/launch.sh

# 5. After the backend is deployed, pre-warm + get the GO/NO-GO verdict.
BACKEND_URL=https://your-backend ADMIN_EMAIL=you@site.com ADMIN_PASSWORD=... \
  node deploy-kit/go-live.mjs
```

There is also a browser version of the wizard at `deploy-kit/wizard/index.html` (open it in any browser), and
the in-app **Setup Wizard** (admin page) shows the same cost-floor status live once the app is running.

## What runs FREE (no keys → still works, just on a paid/fallback path)

| Capability | Free provider | Key to add | Falls back to |
|-----------|---------------|------------|---------------|
| AI (assistant, moderation, ranking, translation) | Groq — Llama | `GROQ_API_KEY` (console.groq.com) | OpenAI |
| Speech-to-text (voice surveys) | Groq — Whisper | same key | OpenAI Whisper |
| Image generation | Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | Bedrock/Titan (~$0.01/img) |
| Email | Brevo (free ~9k/mo) or SES | `BREVO_API_KEY`, or AWS creds | auto-fallback |
| Voice (TTS) | device voice / Polly (free yr 1) | `PROVIDER_TTS=polly` + AWS creds | ElevenLabs |

Only `DATABASE_URL`, `AUTH_JWT_SECRET` (auto-generated), and `APP_URL` are truly required to boot.

## Cost at the floor

AI + image + voice + email = **$0/mo** on the free tiers above. Only recurring cost is **hosting**
(Railway ~$5–20/mo). One-off: Google Play $25 + domain ~$15 (+$99/yr Apple only if you ship native iOS).
The in-app **ProviderAdvisor** later tells you if paid volume ever makes self-hosting a GPU cheaper.

## Re-run safety

`npm run setup` preserves keys you already set (shows `[set]`), only writes what you change, and never touches
lines it doesn't manage. `npm run env:check` is read-only. Safe to run repeatedly.
