# Server GPU Uses — The Two Serverless GPUs (Image & Video)

*A write-up of everywhere the platform uses serverless GPU compute. The platform runs generative-media work in
**two lanes**, each on its own serverless GPU path: **(1) an image GPU** and **(2) a video GPU**. This document
lists every use of each, the provider each runs on, and the cost posture. Current as of 2026-09-07.*

---

## Overview — the two GPUs

"Serverless GPU" is the platform's generative-media compute — it produces **AI images** and **AI videos** (text
is separate LLM work). It splits cleanly into two independent lanes:

| | **GPU 1 — Image** | **GPU 2 — Video** |
|---|---|---|
| **Job** | generate still images | render short videos |
| **Default provider** | Cloudflare Workers AI — FLUX-1-schnell (free) | a paid render vendor (e.g. Abacus.AI) |
| **Fallbacks** | AWS Bedrock (Nova Canvas/Titan) → OpenAI (DALL·E) | — |
| **Self-host switch** | `SELF_IMAGE_URL` (SDXL/FLUX on your own GPU) | `SELF_VIDEO_URL` (your own GPU) |
| **Default posture** | ON (free tier) | **OFF by default** (`VIDEO_ENGINE_RENDER_PROVIDER=none`) — concepts/polls/learning run free; you pay only when a render vendor is deliberately wired |
| **Cost control** | metered under the global AI daily spend cap | budget- **and** count-capped per day |

Posture at launch: **no GPU of your own** — free/cheap hosted providers, with the **self-hosted GPU path already
coded in** and an admin advisor (`provider-advisor.ts` / `scaleAdvisor` / `scale-governor.ts` / `costFloorProfile`)
that tells you **when** to switch to your own GPU.

---

## GPU 1 — Image generation: every use

| # | Use | Function / module | What it generates | Where it shows up |
|---|---|---|---|---|
| 1 | **Shopping category tiles** | `aiCategoryImages` | one original tile per category/subcategory (once each) | storefront/catalog browse tiles |
| 2 | **Services category tiles** | `aiServiceCategoryImages` | one original tile per Services category | the Services section |
| 3 | **App category tiles** | `aiAppCategoryImages` | one original tile per app-taxonomy category | app/discovery tiles |
| 4 | **Catalog / product images** | `catalog.ts` (`GenerateImage`) | product template images — generated once globally, cloned per country (no re-gen) | product listings across the catalog |
| 5 | **AI Creative Suite (ad images)** | `aiCreativeSuiteGenerate` / `creative-suite.ts` | advertiser ad creatives (images), branded with the house watermark/frame | the ad placements (grid, interstitial, social) |
| 6 | **Product-mockup validation images** | `generateMockupVoteSurvey` | a mockup image for a "will it sell?" vote survey | user product-validation surveys |
| 7 | **General image generation** | `image-gen.ts` / `integrations.ts` (`GenerateImage`) | miscellaneous on-platform images | various surfaces |

**Image cost levers (already in place / coded):** default to the free Cloudflare FLUX tier; generate each tile
**once** and skip if it already exists; product templates generated once and cloned per country (not per
listing); meter image spend against the daily AI spend cap; store smaller tiles (512²) + WebP + CDN. See
`COST-LEVERS-CODEABLE.md`.

---

## GPU 2 — Video generation: every use

| # | Use | Function / module | What it generates | Where it shows up |
|---|---|---|---|---|
| 8 | **AI Video Engine (winners only)** | `aiVideoEngineRenderWinners` / `video-engine.ts` / `video-render.ts` | short social videos — only the **budget-capped "winners"** sampled from a huge concept search space | owned social surfaces + consenting-member distribution |
| 9 | **Livestream commercials** | `livestreamChannelBuild` | an AI product image + a short AI commercial per featured product | the Omni-Channel Livestream shopping category |
| 10 | **AI-hosted fallback** | `aiHostedFallbackRun` | an AI-hosted video segment (never a real person) | livestream / host fallback |
| 11 | **Scheduled content creative** | `autoPublishContentCalendar` | creative for scheduled posts | the content calendar / owned channels |

**The honest scale note:** "hundreds of millions of videos" is the **search space**, not the render count. The
engine samples that space, generates cheap concepts (script + storyboard + thumbnail via LLM + the image GPU),
scores them, and renders **only the winners** — a sane, budget-capped number of real videos per day — then tests
them where the platform owns the impressions and learns. Render spend is hard-capped by dollars *and* count, and
the render vendor is off until deliberately wired. See `AI-VIDEO-ENGINE-SPEC.md`.

---

## How the two GPUs work together

The **image GPU feeds the video GPU**: the video engine's cheap concept stage uses the image GPU (thumbnails/
storyboards) before any video is rendered, so most of the funnel is free image/LLM work and only the winners hit
the paid video path. Both lanes are governed by the same spend cap and the same provider/scale advisors, and both
have a self-hosted GPU path ready for when volume justifies owning the hardware.

---

## Compliance touchpoints (pointers, not the detail)

Both GPUs produce AI media, so both are covered by the platform's AI-content controls: a visible "AI-generated"
label + C2PA provenance on generated creatives/videos (`AI-CONTENT-DISCLOSURE-DESIGN.md`), the "never a real/
identifiable person" rule for commercials and the AI host, no guaranteed-results claims, and `#ad` disclosure on
distributed ads. The full legal treatment lives in those compliance docs — this write-up is the **operational map
of the GPU uses**, not the legal brief.

---

## Related docs

- `AI-VIDEO-ENGINE-SPEC.md` — the video engine loop and its cost/distribution guardrails.
- `SELF-HOSTED-PROVIDERS.md` — the provider map and the no-GPU-at-start / self-host-when-ready posture.
- `COST-LEVERS-CODEABLE.md` — the image/video cost levers.
- `AD-MEDIA-AND-TARGETING-DESIGN.md` — advertiser audio/video creatives.
- `AI-CONTENT-DISCLOSURE-DESIGN.md` — the AI-content disclosure layer.
