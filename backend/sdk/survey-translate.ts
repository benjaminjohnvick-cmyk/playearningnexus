// survey-translate.ts — automatic AI translation for surveys (AI-generated AND manually built).
//
// When a user/business selects target languages, the survey's human-readable text (title, description,
// every question + its options, completion tips) is translated into each language and stored as a per-locale
// variant alongside the original. Reuses the platform's existing translation stack (AUTO_TRANSLATE_ENABLED +
// the InvokeLLM path + the dialect-aware normalizeLocale). Surveys must stay NEUTRAL: we translate wording
// only — never change the number, order, or meaning of options, and never inject bias.

import { snapBool, snapNumber } from "./settings.ts";
import { normalizeLocale } from "./translation.ts";

/** Survey auto-translation runs when BOTH the universal translation agent is on AND the survey gate is on. */
export const surveyTranslateEnabled = () => snapBool("AUTO_TRANSLATE_ENABLED", false) && snapBool("SURVEY_AUTO_TRANSLATE_ENABLED", false);
/** Cap how many languages one survey is translated into per request (cost control). */
export const surveyTranslateMaxLanguages = () => Math.max(1, Math.round(snapNumber("SURVEY_TRANSLATE_MAX_LANGUAGES", 20)));

/** Normalize a caller's language selection (array or comma string of locales/labels) to a clean, capped list. */
export function parseLanguages(input: unknown): string[] {
  let raw: string[] = [];
  if (Array.isArray(input)) raw = input.map((x) => String(x));
  else if (typeof input === "string") raw = input.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const s = r.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.slice(0, surveyTranslateMaxLanguages());
}

/** A human hint for a locale so the model targets the right language + dialect (e.g. "pt-BR" → pt / BR). */
export function localeHint(locale: string): string {
  const { language, dialect } = normalizeLocale(locale);
  return dialect ? `${language} (dialect: ${dialect})` : language;
}

/** Build the prompt to translate ONE survey object into ONE target locale, preserving structure exactly. */
export function surveyTranslatePrompt(survey: unknown, locale: string): string {
  return (
    `Translate this survey JSON into ${localeHint(locale)} (target locale "${locale}"). ` +
    `Translate ONLY human-readable text: the title, description, every question, every answer option, and any ` +
    `tips. Keep the JSON structure and ALL keys identical; keep the same number and order of questions and ` +
    `options; do not add, remove, merge, or reorder options; keep any {placeholders}, URLs, numbers, and codes ` +
    `unchanged. Keep the wording NEUTRAL and unbiased — a survey must not lead the respondent. ` +
    `Return {"survey": <the same JSON with text translated>}.\n\nSURVEY:\n` +
    JSON.stringify(survey)
  );
}

// A base44-like client shape (only the piece we use), so this stays decoupled from the runtime import.
interface LLMClient { asServiceRole: { integrations: { Core: { InvokeLLM: (a: unknown) => Promise<unknown> } } }; }

/** Translate a survey object into each target locale. Returns a map { locale → translated survey }. Best-effort:
 *  a locale that fails to translate is skipped (the original still stands). Bounded by surveyTranslateMaxLanguages. */
export async function translateSurvey(
  client: LLMClient,
  survey: Record<string, unknown>,
  locales: string[],
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const locale of locales.slice(0, surveyTranslateMaxLanguages())) {
    const r = await client.asServiceRole.integrations.Core.InvokeLLM({
      prompt: surveyTranslatePrompt(survey, locale),
      response_json_schema: { type: "object", properties: { survey: { type: "object" } }, required: ["survey"] },
    }).catch(() => null) as { survey?: Record<string, unknown> } | null;
    if (r && r.survey && typeof r.survey === "object") out[locale] = r.survey;
  }
  return out;
}
