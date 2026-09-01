import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { surveyTranslateEnabled, parseLanguages, translateSurvey } from "../../sdk/survey-translate.ts";

// surveyTranslate (authenticated) — translate an EXISTING survey into languages the creator selects later,
// using the same neutral, structure-preserving translator as the AI and manual creators. Only the survey's
// owner (or an admin) can translate it. Gated behind AUTO_TRANSLATE_ENABLED + SURVEY_AUTO_TRANSLATE_ENABLED.
//   Body: { survey_id, target_languages: string[] }  → { ok, translated_languages }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveyTranslateEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Survey auto-translate is off (AUTO_TRANSLATE_ENABLED + SURVEY_AUTO_TRANSLATE_ENABLED)." });
    }

    const b = await req.json().catch(() => ({}));
    const surveyId = String(b.survey_id || "").trim();
    const languages = parseLanguages(b.target_languages ?? b.languages);
    if (!surveyId) return Response.json({ error: "survey_id is required." }, { status: 400 });
    if (!languages.length) return Response.json({ error: "Select at least one language (target_languages)." }, { status: 400 });

    const survey = await db.get("PPCSurvey", surveyId).catch(() => null) as Record<string, unknown> | null;
    if (!survey) return Response.json({ error: "Survey not found." }, { status: 404 });
    if (String(survey.creator_id) !== String(user.id) && user.role !== "admin") {
      return Response.json({ error: "You can only translate your own survey." }, { status: 403 });
    }

    const source = { title: survey.title, product_name: survey.product_name, questions: survey.questions };
    const translations = await translateSurvey(base44, source, languages).catch(() => ({} as Record<string, unknown>));
    // Merge with any existing translations so adding a language doesn't drop earlier ones.
    const existing = (survey.translations && typeof survey.translations === "object") ? survey.translations as Record<string, unknown> : {};
    const merged = { ...existing, ...translations };
    const translated_languages = Object.keys(merged);
    if (Object.keys(translations || {}).length) {
      await db.update("PPCSurvey", surveyId, { translations: merged, translated_languages }).catch(() => null);
    }

    return Response.json({ ok: true, enabled: true, survey_id: surveyId, translated_languages, added: Object.keys(translations || {}) });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
