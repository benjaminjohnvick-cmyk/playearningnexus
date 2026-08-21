# AI Creative Suite — end-to-end AI ad creative for all three tiers

An end-to-end system that generates ads of every type and format, tests them, learns which creative wins, and
improves itself — available to Tier 1, Tier 2, and Tier 3 advertisers, with capabilities that scale by tier.
It unifies the pieces the platform already had (LLM + image generation, the A/B infrastructure, and the
`OptimizationSignal` / `AgentLearningMemory` self-improvement loop) into one coherent product.

## The end-to-end loop

**Brief → Generate → Screen → Score → Test → Learn → Improve.**

1. **Generate** (`aiCreativeSuiteGenerate`) — one brief fans out into compliant, brand-aligned variants across
   every requested format, biased by what the advertiser's playbook has already learned wins.
2. **Screen** — every variant passes the compliance guard before it can ship (see below).
3. **Score** — each variant gets a 0–100 predictive creative score before any spend.
4. **Test** (`aiCreativeSuiteExperiment`) — launch an A/B or (eligible tiers) multivariate test from the
   variants; the existing winner/metrics loop measures it.
5. **Learn** (`aiCreativeSuiteLearn`) — real performance becomes signed learning signals; the playbook rebuilds
   and tells the generator which hooks, tones, lengths, CTAs, and visual styles to favor next.
6. **Improve** — the next generation is conditioned on the updated playbook, so the system gets better with
   every test. In `auto` mode (tier-gated, under a global cap) it also concludes tests, promotes winners, and
   pauses losers on its own.

`aiCreativeSuiteStatus` returns the whole dashboard: tier capabilities, quota, active experiments, the learned
playbook + recommendations, and any fatigued creatives due for a refresh.

## Ad types and formats (all of them)

Text via `Core.InvokeLLM`, visuals via `Core.GenerateImage`, video as scripts/storyboards (no video is
rendered). The catalog lives in `AD_FORMATS` — add one there and it's instantly offered to every tier that
allows it:

between-survey interstitial · social feed post · story/reel (1080×1920) · square post (1080×1080) · IAB banners
(300×250, 728×90, 320×50, 160×600) · native/sponsored card · search/PPC headlines · product-page / landing copy
· email creative (subject + preview + body) · carousel · short video script (6–15s) · video storyboard (30–60s).

Each format carries real specs (character budgets, dimensions, surfaces) so generated copy fits and image
briefs are production-ready.

## The tier matrix

Every field is admin-tunable via a `CREATIVE_SUITE_*` setting; the ladder is monotonic (a higher tier never
has less):

| Capability | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Creatives / 4-week period | 120 | 400 | unlimited |
| Variants per brief | 5 | 8 | 12 |
| Formats | all | all | all |
| Concurrent experiments | 3 | 10 | unlimited |
| Multivariate testing | — | ✓ | ✓ |
| Autonomy ceiling | assist | assist | auto |
| Learning depth | advanced | advanced | predictive |
| AI images | ✓ | ✓ | ✓ |
| Video scripts | ✓ | ✓ | ✓ |
| Brand kit / voice memory | ✓ | ✓ | ✓ |
| Audience/locale variants | — | ✓ | ✓ |
| Predictive creative score | ✓ | ✓ | ✓ |
| Auto-refresh (fatigue) | — | ✓ | ✓ |

## The self-learning playbook (the "self-improving" core)

Each generated creative is tagged on nine dimensions — format, hook, tone, length, cta_style, visual_style,
emoji, urgency, audience. When a test resolves, each arm's real CTR (relative to the test mean) becomes a
signed learning signal. `buildCreativePlaybook` aggregates those signals into a sample-smoothed ranking per
dimension, so a proven winner outranks a one-off fluke. The playbook's top value on each axis is fed straight
back into the next generation prompt, and surfaced to the advertiser as plain recommendations
("Lean into hook = 'question' — it's your strongest performer"). Each advertiser gets their own private
playbook; a platform-wide playbook is available too.

## The compliance guard (a first-class feature)

Because the platform's whole spine is "advertising value delivered, never a financial return," the suite
**screens every generated creative before it can ship.** `screenCreativeCopy` blocks any copy that promises or
implies a financial return, ROI, "2x/4x", "double your money", guaranteed earnings/income, "risk-free",
"get rich", or investment framing; "invest"-style wording is flagged as a softer warning. A blocked creative is
never persisted or shipped — it's returned flagged so the advertiser sees why, and the generator is instructed
up front to stay compliant, so blocks are rare. This keeps the AI from ever manufacturing the exact claims the
rest of the system is careful never to make.

## Additional features included

- **Brand kit / voice memory** — generation is conditioned on the advertiser's saved voice, palette, and
  do/don't list, so everything is on-brand.
- **Predictive creative score** — a 0–100 pre-flight score blends playbook alignment, craft heuristics
  (headline fits the format, a CTA is present, body isn't over-long), and a hard compliance gate (a
  non-compliant creative can't score above 40).
- **Creative-fatigue detection + auto-refresh** — `isFatigued` flags a creative whose recent CTR has fallen a
  set fraction below its own baseline (or that's simply old); on eligible tiers the suite regenerates it.
- **One-brief → all-formats fan-out** — a single brief produces a coherent campaign across every surface/size.
- **Audience/locale variants** (Tier 2/3) — the same message adapted per segment.
- **Winner → auto-improve** — the winning arm's attributes become the seed for the next generation.
- **Autonomy cap** — the default global cap is `assist` (1-click apply); nothing goes fully self-driving until
  an admin raises `CREATIVE_SUITE_AUTONOMY_CAP`, keeping the compliance posture safe by default.

## What's coded

- **`backend/sdk/creative-suite.ts`** — the pure, unit-tested core: format registry, tier capability matrix,
  compliance guard, self-learning playbook, predictive scoring, fatigue detection, quota, and the DB bridge
  (`recordCreativeOutcome` / `playbookFor`) that reuses `OptimizationSignal` + `AgentLearningMemory` (no new
  learning tables). Tests in `creative-suite.test.ts` (11, all passing).
- **Functions** — `aiCreativeSuiteGenerate`, `aiCreativeSuiteExperiment`, `aiCreativeSuiteLearn`,
  `aiCreativeSuiteStatus` (registered in `_manifest.json`).
- **Settings** — the full `CREATIVE_SUITE_*` block (enable, global autonomy cap, fatigue thresholds, and a
  per-tier set for quotas, variants, formats, experiments, multivariate, autonomy, learning depth, images,
  video, brand kit, localization, predictive score, auto-refresh).
- **Schema** — one new table, `CreativeAsset` (generated variants + live performance); the A/B tests reuse the
  existing `AdCreativeTest` table.

## API sketch

- `POST /functions/aiCreativeSuiteGenerate` — `{ tier, brief, formats[], audience?, count?, brand_kit?, generate_images? }`
  → compliant scored variants (persisted as `CreativeAsset`).
- `POST /functions/aiCreativeSuiteExperiment` — `{ tier, asset_ids[], type: "ab"|"multivariate", test_name?, objective? }`
  → an `AdCreativeTest` with an even split.
- `POST /functions/aiCreativeSuiteLearn` — `{ tier, advertiser_id?, test_id?, autonomy? }` → records signals,
  rebuilds the playbook, returns next-generation attribute guidance (auto mode also concludes ready tests).
- `GET /functions/aiCreativeSuiteStatus?tier=tier1` → the dashboard payload.

## Next step (not built yet)

An advertiser-facing **Creative Studio** page (brief box → generated variants gallery with scores →
one-click A/B launch → live playbook + recommendations) is the natural front-end for these endpoints. Say the
word and it's the next build.
