# AI Survey Suite — Pollfish-parity survey creation, on your stack and branding

An end-to-end AI survey builder that matches what Pollfish's AI survey tools do, on the platform's own data and
in its own branding — unified with the self-learning + A/B machinery from the Creative Suite. It **keeps every
existing survey feature** (`PPCSurvey`, `generateAISurvey`, insights, matching, UX learning) and adds a
cohesive suite on top.

## Pollfish parity — what was researched and replicated

Pollfish's AI survey tools offer: prompt/goal → full survey; paste-an-existing-survey → restructure; 19+
question types; AI editing (reword, expand, change tone, spellcheck, translate, add/remove/shuffle options,
undo); logic (piping, quotas, shuffling, skip/branching); best-practice guidance; advanced methods (A/B,
conjoint, MaxDiff, Van Westendorp); AI Reports (stats + open-end coding → report); conversational AI surveys
with theme summaries; and multi-language. Every one of those is covered below.

## The suite

1. **Generate** (`aiSurveySuiteGenerate`) — a prompt, goal, or topic becomes a full professional survey with a
   sensible **mix of question types**; or **paste an existing survey** and it's restructured into the builder.
   Every question is quality- and compliance-screened and the survey gets a 0–100 quality score. Generation is
   biased by the **self-learning playbook**.
2. **Edit** (`aiSurveySuiteEdit`) — per-question ops: **reword, expand, shorten, change tone, spellcheck,
   translate** (AI), and **shuffle options, add/remove option, add a neutral "Prefer not to say", change
   question type, undo** (deterministic, with an undo history).
3. **Advanced methods** (`aiSurveySuiteMethod`) — insert a ready-made block for **A/B split, conjoint, MaxDiff
   (best–worst), Van Westendorp price sensitivity, or Gabor–Granger pricing**.
4. **AI Reports** (`aiSurveySuiteReport`) — reads the questionnaire + responses, tallies closed questions
   (deterministic), **codes open-ended answers into themes**, and drafts an evidence-based summary with
   recommendations. Conversational follow-up + theme summaries are on by default.
5. **Learn** (`aiSurveySuiteLearn`) — a fielded survey's completion becomes signed learning signals per
   question attribute (type / position / length); the **playbook** rebuilds and guides the next survey.
6. **Status** (`aiSurveySuiteStatus`) — the Survey Studio dashboard: question-type palette, methods, locales,
   recent drafts, and the live playbook + recommendations.

## 19+ question types

single-select · multi-select · dropdown · yes/no · star rating · numeric rating scale · Likert · NPS ·
semantic differential · slider · ranking · matrix (single) · matrix (multi) · constant sum · numeric · open
(short) · open (paragraph) · date/time · image choice · rating grid. The registry lives in `QUESTION_TYPES` —
add one and it's offered everywhere.

## The quality + compliance guard

Two jobs in one screen. **Methodology quality:** flags leading questions, loaded language, absolute terms
("always/never"), double-barreled questions, and over-long stems — Pollfish's "best-practice guidance."
**Compliance spine:** hard-blocks any survey copy that implies guaranteed earnings, income, returns, ROI,
"$X/day", or "risk-free" — the same guard the Creative Suite uses, so the AI can't manufacture a claim the rest
of the platform avoids. A blocked question is dropped from the shipped survey.

## The self-learning playbook

Each survey is tagged on question_type, position (early/mid/late), length, scale points, neutral-option
presence, tone, and topic. When a survey is fielded, its completion becomes signed signals; a sample-smoothed
ranking tells the generator which choices complete best — so surveys get better with every wave. Reuses the
platform's `OptimizationSignal` + `AgentLearningMemory` loop (no new learning tables).

## What's coded

- **`backend/sdk/survey-suite.ts`** — pure, unit-tested core: question-type registry, advanced-method block
  generators, quality+compliance guard, survey quality score + time estimate, deterministic edit ops
  (seeded shuffle, add-neutral), locales, and the self-learning playbook + DB bridge (`recordSurveyOutcome` /
  `surveyPlaybookFor`). Tests in `survey-suite.test.ts` (8, all passing).
- **Functions** — `aiSurveySuiteGenerate / Edit / Method / Report / Learn / Status` (registered in
  `_manifest.json`).
- **Settings** — `SURVEY_SUITE_*` (enable, max questions, methods, translation, conversational).
- **Schema** — one new table, `SurveyDraft` (generated surveys + edit history + quality). Responses reuse
  `PPCSurveyResponse`.
- **UI** — `src/pages/SurveyStudio.jsx` (registered in `pages.config`): prompt/paste box + question-type
  palette → generated survey with a quality score and per-question edit menu → advanced-method insert → report
  + live playbook.

## Kept intact

Nothing existing was removed. `generateAISurvey`, `aiSurveyGenerator`, `aiSurveyInsightsDashboard`,
`aiSurveyUXLearningEngine`, `createPPCSurvey`, matching, and the rest continue to work; the suite sits above
them as the unified, Pollfish-parity builder.
