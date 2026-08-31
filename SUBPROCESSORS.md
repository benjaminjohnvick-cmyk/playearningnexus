# Subprocessors

The third parties that may process personal or operational data on GamerGain's behalf. Publish a version
of this list (privacy laws often require it) and keep it current. Only providers you actually enable
apply. Not legal advice.

| Subprocessor | Purpose | Data it may process | Region |
|---|---|---|---|
| Railway (or your host) | App + backend hosting | All app data in transit/at rest | [region] |
| Managed PostgreSQL | Primary database | All stored app data | [region] |
| Amazon Web Services — Bedrock | AI image generation (catalog) | Text prompts (no personal data) | [region] |
| Amazon Web Services — S3 (optional) | Image storage | Generated images | [region] |
| LLM provider (Anthropic and/or OpenAI) | Text generation, assistant, optimization | Prompt content; assistant messages | US/[region] |
| Stripe (optional) | Card payment processing | Payment + limited billing data | US/global |
| PayPal / Venmo / Cash App (optional) | Alternate payments/payouts | Payment identifiers | US/global |
| SendGrid or Amazon SES | Transactional & marketing email | Email address, message content | US/[region] |
| Twilio (optional) | SMS (off by default) | Phone number, message content | US/global |
| ipapi.co (or equivalent) | IP geolocation → country | IP address (transient) | US/global |
| exchangerate-api.com (or equivalent) | Currency conversion rates | None (rates only) | US/global |
| Survey/offer providers (e.g. BitLabs) | Earning activities | Activity completion signals, survey responses | Various |
| Affiliate networks (e.g. Amazon Associates) | Affiliate links/feeds (only if you enable) | Click/referral data via outbound links | Various |
| Error/analytics (optional, e.g. Sentry) | Crash & performance monitoring | Diagnostic data | [region] |
| App stores (Apple, Google) | Distribution & in-app purchase | Store account/purchase data | Global |

Guidance:
- Sign a **Data Processing Agreement** with each subprocessor that handles personal data.
- Remove rows for services you don't use; add any you add.
- Notify users of material changes to this list where your privacy notice or law requires.
- Affiliate retailers reached through outbound "find the real thing" links are **independent
  controllers**, not our subprocessors — we don't send them account data; the user leaves our app.

## AI video render (optional — only if enabled)

- **Abacus.AI** — AI video generation aggregator (routes to Veo/Kling/Luma/Runway/Seedance). Used only if
  `VIDEO_ENGINE_RENDER_PROVIDER='abacus'`. Processes the ad prompt + any product image supplied. Abacus states
  it does not claim ownership of generated content and maintains a **Zero Data Retention** arrangement with its
  upstream model partners (e.g. OpenAI), so uploaded product specs/marketing prompts are not retained or used to
  train public models — confirm the current ZDR terms in your DPA. Sign a DPA before enabling.
- **Serverless GPU host** (Replicate / Modal / RunPod — whichever you wire to `SERVERLESS_GPU_ENDPOINT`) — runs
  open video models on your behalf if `VIDEO_ENGINE_RENDER_PROVIDER='serverless_gpu'`. Add the specific vendor
  here when chosen; sign a DPA.
