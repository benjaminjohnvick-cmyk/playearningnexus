# AI SEO & AI-Search (Answer-Engine) Optimization — Design & Build

*AI-powered optimization for two kinds of discovery — classic **search engines** and the new **AI answer
engines** (ChatGPT, Perplexity, AI overviews) — across the **website, the app listing, and advertisers'
listings**. This fills the `seo_metadata` gap: that autonomy domain now has a real feature and is routed through
the kernel. Current as of 2026-09-08. Not legal advice.*

---

## Why two kinds of optimization

- **Classic SEO** gets pages indexed and ranked: an optimized title + meta description, a canonical URL, Open
  Graph/Twitter cards, and **JSON-LD structured data** so search engines understand and show rich results.
- **AI-search (a.k.a. GEO / answer-engine optimization)** gets the site **found, quoted, and cited by AI answer
  engines**: concise quotable **answer snippets**, **FAQ schema** (answer engines lift Q&A directly), clear
  entity data, and an **`llms.txt`** manifest that tells AI crawlers what the site is and where its key content
  lives. Both run off one pipeline.

## The module — `backend/sdk/seo.ts` (pure builders)

Deterministic, unit-tested (6/6) builders the functions assemble AI output into:
- `buildMetaTags` — title/description clamped to spec (≤60 / ≤160), canonical, OG, Twitter.
- `buildJsonLd` — `Product` (with `Offer` + `AggregateRating` when real data exists), `SoftwareApplication`
  (app), `WebPage`, and `FAQPage`; `buildSiteJsonLd` adds `Organization` + `WebSite`+`SearchAction`.
- `buildLlmsTxt` — the `/llms.txt` AI-crawler manifest.
- `seoScore` — a 0–100 readiness audit that rewards structured data + FAQ and lists concrete fixes.

The AI writing (titles, descriptions, keywords, answer snippets, FAQs) runs through the **model router**
(`modelForJob("seo")`), so you can point SEO at any model — and it **optimizes wording only, never inventing
facts, prices, ratings, or guarantees** (advertising-compliance matters).

## The functions

| Function | Who | What |
|---|---|---|
| `seoGenerateMetadata` | admin/internal | Generate + store SEO/AI-search metadata for one entity (page/product/app/advertiser/category). **Routed through the `seo_metadata` autonomy domain** — graduates like every other operational action. |
| `seoAuditRun` | admin | Audit readiness — score arbitrary pages you pass in, or summarize stored coverage and list the lowest-scoring entities. Read-only. |
| `seoLlmsTxt` | admin | Generate the `llms.txt` manifest to publish at `/llms.txt`. |
| `advertiserSeoAssist` | advertiser | An advertiser optimizes **their own** listing on demand — metadata + JSON-LD + a readiness score with concrete recommendations. Self-service (not autonomy-gated). |
| `seoStatus` | admin | Read of SEO/AI-search config + coverage + which model runs the `seo` job. |

Data lives on a new `SeoMetadata` entity (one record per entity). Settings live under a new **"SEO & Search"**
category: `SEO_ENABLED`, `AI_SEARCH_ENABLED`, `SEO_SITE_NAME`, `SEO_SITE_URL`, `SEO_TITLE_SUFFIX`,
`SEO_DEFAULT_DESCRIPTION`, and the `AI_JOB_MODEL_SEO` router override.

## The three surfaces

- **Website** — pages/products/categories get titles, meta, canonical, OG, JSON-LD, FAQ, and the site-level
  Organization/WebSite schema + `llms.txt`.
- **App** — the app listing gets `SoftwareApplication` structured data (app-store-style optimization).
- **Advertisers** — each advertiser can optimize their listing for both search and AI answer engines via
  `advertiserSeoAssist`, with a readiness score and fixes.

## Autonomy integration — the gap is filled

`seo_metadata` was previously **non-gateable** ("no SEO feature exists yet"). It is now a **gateable, wired**
domain: `seoGenerateMetadata` routes its writes through `gateAndRun("seo_metadata", …)`, so metadata generation
auto-applies once the domain earns autonomy (else it queues for the overseer). This brings the gateable set to
**six** (content_calendar, personalization_home, ad_optimization, catalog, survey, **seo_metadata**), all wired —
so the "Loop routed" coverage meter stays at **100%** with SEO now included.

## Files

- **New:** `backend/sdk/seo.ts`, `backend/sdk/seo.test.ts` (6/6), `backend/functions/seoGenerateMetadata/`,
  `seoAuditRun/`, `seoLlmsTxt/`, `advertiserSeoAssist/`, `seoStatus/`.
- **Changed:** `backend/sdk/ai-models.ts` (`seo` job), `backend/sdk/autonomy-kernel.ts` (`seo_metadata` →
  gateable/wired), `backend/sdk/settings.ts` (SEO settings), `backend/db/schema.sql` (`SeoMetadata`),
  `backend/functions/_manifest.json`.

## Related

- `AI-MODEL-MODULE-AND-AUTONOMY-MAP.md` — the model router the `seo` job plugs into.
- `AUTONOMY-GATING-AND-OVERSIGHT.md` — the gate + coverage model this now counts toward.

*Not legal advice — AI-generated copy optimizes wording only and never fabricates facts, prices, or claims.*
