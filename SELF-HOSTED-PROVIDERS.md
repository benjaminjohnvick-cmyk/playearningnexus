# External services — own-it inventory (A/B/C) + no-GPU hosted swap layer + self-host advisor

Scope: every external dependency **except survey providers and payment providers** (those stay as-is). This
is the honest map of what you can make your own, what you can host cheaply, and what you can't build — plus
the code layer that flips each capability to a free/cheap hosted provider without touching call sites.
**Chosen posture: no GPU of your own *at the start* — free/cheap hosted providers, the self-hosted GPU path
coded in, and an admin advisor that tells you WHEN to switch to it.**

## The three buckets

**A — already yours (logic on top of a model or your own data).** Not really "services" you rent; your own
logic, mostly already self-owned: translation (`chat-i18n.ts`), moderation/scam-guard, personalization/
ranking/optimization/experiments, analytics/telemetry, fraud heuristics, matching, catalog normalization,
ops automation, and the "KYC" *preference* profile. All text-reasoning tasks → they run on whatever LLM you
point them at, now **Llama on Groq's free tier**.

**B — swap to hosted open models (no GPU).** LLM → **Llama on Groq** (free). Speech-to-text → **Whisper on
Groq** (free). Text-to-speech → **OpenAI `tts-1` / Amazon Polly** (Polly free tier 5M chars/mo first year).
Image → **Cloudflare Workers AI** FLUX-1-schnell (free). Each falls back to a working provider until keyed.

**C — you realistically can't self-build (infra / data / relationships / other platforms' APIs).** Email
deliverability, SMS, social posting/ads, product sourcing/retail/affiliate feeds + shipping tracking. Note:
the social/retail/shipping APIs are **free to call** — their "cost" is ad spend and cost-of-goods, not a
service fee. The only recurring service costs in C are **email** and **SMS**.

## Capability → provider (current defaults)

| Capability | Setting (default) | Hosting | Falls back to |
|-----------|------------------|---------|---------------|
| LLM | `LLM_PROVIDER = groq` | Groq free — Llama 3.1-8B / 3.3-70B | OpenAI until `GROQ_API_KEY` set |
| Speech-to-text | `PROVIDER_STT = groq` | Groq free — `whisper-large-v3-turbo` | OpenAI Whisper until key set |
| Text-to-speech | `PROVIDER_TTS = managed` | ElevenLabs; `=openai` (tts-1) or `=polly` (free tier) | ElevenLabs |
| Image | `IMAGE_PROVIDER = cloudflare` | Cloudflare Workers AI — FLUX-1-schnell, free | aws_bedrock/Titan until CF creds set |
| Email | `EMAIL_PROVIDER = ses` | Amazon SES (~$0.10/1k); `=brevo` free ~9k/mo | auto-falls back to any configured provider |

## Cost-reduction layer

1. **Email default moved off SendGrid → Amazon SES** (SendGrid's free tier was discontinued). SES is cheapest
   at scale (~$0.10/1k, reuses AWS creds); **Brevo** added as a free-tier option (~9k/mo). `pickEmailProvider()`
   auto-falls back to whichever provider's creds are set (SES → Brevo → SendGrid → SMTP).
2. **Amazon Polly TTS** (`PROVIDER_TTS=polly`) via existing AWS creds — free 5M chars/mo first year, then ~$4/1M.
3. **TTS audio cache** (`TTS_CACHE_ENABLED`, on): repeated prompts voice once (biggest TTS cut; shared with `REDIS_URL`).

Bigger levers, ranked: cache repeated output; free tiers first + paid fallback; right-size (cheap voices + 8B
model for simple jobs); shift channels (SMS → push + email); self-host once the advisor says a GPU (or CPU
Piper TTS) beats the bills. SMS stays pay-per-use — minimize it.

## The self-host advisor (admin: /ProviderAdvisor)

Records **only REAL money spent** per capability per month (`ProviderUsage`). Free-tier (Groq, Cloudflare,
Polly's free year) and self-hosted calls cost ~$0. Shows month-to-date spend, a run-rate projection, and the
GPU break-even (`GPU_MONTHLY_COST_USD`, $400/mo), and recommends switching a capability to `self` once
projected spend crosses break-even × `SELFHOST_RECOMMEND_MARGIN` (1.2). Piper runs TTS on CPU — no GPU needed.

## Keys needed from you

- **`GROQ_API_KEY`** (free, console.groq.com) → LLM + speech-to-text.
- **`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`** (Workers AI perm, free) → image.
- **Email:** AWS creds + a verified SES sender, or `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` (free tier).
- **TTS:** reuses AWS creds for Polly, or `OPENAI_API_KEY` for tts-1, or keep ElevenLabs.
- Optional **`REDIS_URL`** → shared TTS/translation cache across instances.

## Files

New: `providers.ts`, `provider-advisor.ts`, `providerAdvisor` fn, `ProviderAdvisor.jsx`, `ProviderUsage`.
Modified: `integrations.ts` (Groq/self LLM, Cloudflare/self image, SES/Brevo email + fallback, metering),
`transcription.ts` (Groq/self STT), `tts.ts` (OpenAI/Polly/self TTS + audio cache), settings.
