import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  surveySuiteEnabled, surveyMaxQuestions, surveyMethodsEnabled, surveyTranslationEnabled, surveyConversationalEnabled,
  QUESTION_TYPES, METHODS, LOCALES, surveyPlaybookFor, surveyRecommendations,
} from "../../sdk/survey-suite.ts";

// aiSurveySuiteStatus — the Survey Studio dashboard: what's enabled, the question-type palette, advanced
// methods, locales, recent drafts, and the live self-learning playbook + recommendations.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const today = new Date().toISOString();

    const [drafts, playbook] = await Promise.all([
      db.count("SurveyDraft", { advertiser_id: user.id }).catch(() => 0),
      surveyPlaybookFor(db, user.id, today).catch(() => null),
    ]);

    return Response.json({
      enabled: surveySuiteEnabled(),
      config: {
        max_questions: surveyMaxQuestions(),
        methods_enabled: surveyMethodsEnabled(),
        translation_enabled: surveyTranslationEnabled(),
        conversational_enabled: surveyConversationalEnabled(),
      },
      question_types: QUESTION_TYPES.map((q) => ({ key: q.key, label: q.label, category: q.category })),
      methods: METHODS,
      locales: LOCALES,
      drafts: drafts,
      learning: {
        sample_size: playbook?.sample_size ?? 0,
        top_attributes: playbook?.top ?? {},
        recommendations: playbook ? surveyRecommendations(playbook) : [],
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
