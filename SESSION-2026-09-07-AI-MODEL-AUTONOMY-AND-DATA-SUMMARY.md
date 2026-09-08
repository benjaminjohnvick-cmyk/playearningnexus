# Session Summary — Swappable AI Models, Autonomy Gating & Data Strategy (2026-09-07 → 09-08)

*A plain-language record of what was built and decided this session, for the owner, counsel, and future
sessions. It ties together the three design/implementation docs added this session and flags the items counsel
should confirm. **Not legal advice.***

---

## What was built (and where the detail lives)

**1. A swappable AI-model module** — `backend/sdk/ai-models.ts`. Every LLM call now names a *job*
("document", "reasoning", "ad_copy", …) and one registry decides which model runs it. Swapping in a future
model is one registry row; re-pointing a job is a settings change — none of the ~190 call sites change.
- **GPT-6 Astra** (OpenAI's flagship, released 2026-09-03) is wired in as the `frontier` tier, pointed at the
  hard jobs (documents, complex reasoning). It is **opt-in**: the global cost brake (`AI_FORCE_CHEAP_TIER`)
  keeps it off until deliberately enabled, so cost stays capped by default (~$10/$50 per M tokens).
- **A unified gateway provider** (`LLM_PROVIDER=gateway`, OpenRouter-style) lets one API key reach every
  company's models by id, so "add the latest model" becomes a settings change.
- `aiModelStatus` (admin) shows the registry + which model runs which job.
- Detail: **`AI-MODEL-MODULE-AND-AUTONOMY-MAP.md`**.

**2. An expanded autonomy domain map** — `backend/sdk/autonomy-kernel.ts`. The operational loop of "running the
business" was added as reversible (`auto_ok`) domains that graduate on trust (ad optimization within caps,
content calendar, SEO, personalization, analytics/reporting, doc generation, ops monitoring, moderation triage),
while the **money / identity / legal / security spine** was hardened as permanent human gates.

**3. An autonomy gate + exception-oversight dashboard** — `backend/sdk/autonomy-gate.ts`,
`backend/functions/autonomyOversight/entry.ts`, `src/pages/AutonomyOversight.jsx`.
- `gateAndRun("<domain>", …, run)` routes any operational action through the kernel: it computes live trust,
  applies the hard walls (permanent-gate + irreversible + global brake), then either runs the action
  (reversible, logged) or queues it for the overseer — recording a decision either way so the domain earns
  autonomy. Fails **closed**.
- The dashboard is **exception-based**: it surfaces only what needs a human (failures, stale approvals, domains
  not earning trust, spend near cap, brakes) plus a per-domain trust grid and a **"Loop routed %"** coverage
  meter.
- First live wirings: `content_calendar`, `personalization_home`, `ad_optimization`; the advertiser report
  writer routes through the `document` model job.
- Detail: **`AUTONOMY-GATING-AND-OVERSIGHT.md`**.

**4. A server-GPU uses write-up** — **`SERVER-GPU-USES.md`** — the operational map of the two serverless GPUs
(image + video) and every use of each. (Not a legal doc; kept out of Legal & Compliance by request.)

## Decisions & flags for the owner and counsel

- **Astra is real and swappable.** No lock-in: the registry + gateway mean any provider's model can serve any
  job. Frontier use is gated behind the cost brake.
- **Using AI outputs to train our own models — bounded.** Provider terms (Anthropic *and* OpenAI) allow using
  outputs to build **specialized, non-competing** tools (our targeting/ranking/personalization models qualify)
  but **prohibit** training a competing general-purpose model or using outputs as its training targets.
  **Counsel to confirm** our uses stay on the allowed side.
- **Bootstrapping on "real" data — use the safe lane.** Prefer **licensed open datasets and published
  statistics** for cold-start priors; **avoid** scraping personal data or bulk-scraping a site against its ToS.
  **Counsel sign-off** before any bulk third-party scrape. Synthetic/LLM-seeded data is a warm-start prior only
  — never shown to users/advertisers as real activity.
- **"100% autonomous" has a permanent floor.** Even with an AGI-labelled model, a business needs an accountable
  human/entity on money, identity, legal, and irreversible actions — capability doesn't change accountability
  law. The achievable target is the **reversible operational loop fully routed and earning autonomy, with a thin
  human layer on the irreducible gates**. The gates are a design choice, not an incompletion. **Counsel to
  confirm** the irreducible permanent-gate list for our jurisdiction and model.
- **Training timeline at ~200k users** (order-of-magnitude, depends on DAU): the learning models reach *useful*
  within hours-to-a-day; broad cohort confidence in days-to-weeks (priors cover the long tail permanently);
  **autonomy graduation is human-paced** — ~1–3 weeks per domain, set by review cadence, not user count.

## Documents added / updated this session (in bundle 38)

| Doc | 02 - Guides | 05 - PDFs | Repo | Project |
|---|---|---|---|---|
| SERVER-GPU-USES | ✓ md+pdf | ✓ pdf | ✓ | ✓ |
| AI-MODEL-MODULE-AND-AUTONOMY-MAP | ✓ md+pdf | ✓ pdf | ✓ | ✓ |
| AUTONOMY-GATING-AND-OVERSIGHT | ✓ md+pdf | ✓ pdf | ✓ | ✓ |
| SESSION-2026-09-07-… (this doc) | ✓ md+pdf | ✓ pdf | ✓ | ✓ |

## Status

All code is pushed to GitHub (`playearningnexus`, main) and mirrored into the bundle's Code Backup; all bundle
zips rebuilt. Validation each step: structural audit passed (988 functions), all changed files parse, the
autonomy gate's decision logic tested 6/6.

*Not legal advice — the compliance flags above are for the attorney to confirm.*
