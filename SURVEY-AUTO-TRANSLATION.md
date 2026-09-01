# Survey Auto-Translation

Both survey creators — the **AI survey creator** (`generateAISurvey`) and the **manual survey creator**
(`createPPCSurvey`) — now auto-translate a survey into the languages a user/business selects. Reuses the
existing universal-translation stack; nothing changes about the money model or survey integrity.

## How it works
- The creator passes `target_languages` (BCP-47 codes or labels, e.g. `["es-419", "pt-BR", "fr"]`).
- When enabled, each survey's human-readable text — title, description, every question, every option, tips —
  is translated into each language and stored as a per-locale variant **next to the original** (the original
  is never replaced). The AI creator returns `translations` + `translated_languages`; the manual creator saves
  them onto the `PPCSurvey` record.
- Existing surveys can be translated later by selecting languages via **`surveyTranslate`**
  (`{ survey_id, target_languages }`), which merges new languages with any already present.

## Integrity guarantees
- **Neutral + structure-preserving:** the translator changes wording only. It never adds, removes, merges, or
  reorders answer options, never changes the number of questions, and keeps placeholders, URLs, numbers, and
  codes unchanged — so a translated survey stays unbiased and directly comparable to the original.
- **Dialect-aware:** targets language *and* dialect via the existing `normalizeLocale` (e.g. `pt-BR` →
  Brazilian Portuguese).
- **Bounded + best-effort:** capped per request; a language that fails to translate is skipped and the
  original still stands.

## Settings (default-safe, wizard-surfaced)
- `SURVEY_AUTO_TRANSLATE_ENABLED` — OFF by default (sensitive). Also requires the universal translation agent
  `AUTO_TRANSLATE_ENABLED` to be ON.
- `SURVEY_TRANSLATE_MAX_LANGUAGES` — max languages per survey per request (default 20).

## Code
- SDK: `backend/sdk/survey-translate.ts` — `parseLanguages`, `surveyTranslatePrompt`, `translateSurvey`.
- Wired into `generateAISurvey` and `createPPCSurvey`; standalone `surveyTranslate` for existing surveys.
- Translations live in the survey's `translations` map keyed by locale (no schema change — JSONB).
