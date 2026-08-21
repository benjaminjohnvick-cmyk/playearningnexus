import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { surveySuiteEnabled, surveyMethodsEnabled, buildMethodBlock, METHODS, scoreSurvey } from "../../sdk/survey-suite.ts";

// aiSurveySuiteMethod — generate an advanced research-method block (A/B, conjoint, MaxDiff, Van Westendorp,
// Gabor-Granger) and optionally append it to a SurveyDraft.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveySuiteEnabled() || !surveyMethodsEnabled()) return Response.json({ error: "Advanced methods are disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const method = String(body.method ?? "");
    if (!METHODS.some((m) => m.key === method)) {
      return Response.json({ error: "Unknown method.", available: METHODS.map((m) => m.key) }, { status: 400 });
    }
    const block = buildMethodBlock(method as never, body.input || body);
    if (!block) return Response.json({ error: "Could not build the method block." }, { status: 400 });

    let survey = null;
    if (body.draft_id) {
      const draft = await db.get("SurveyDraft", String(body.draft_id)).catch(() => null) as Record<string, unknown> | null;
      if (draft && draft.advertiser_id === user.id) {
        const questions = [...(Array.isArray(draft.questions) ? draft.questions as Record<string, unknown>[] : []),
          ...block.questions.map((q) => ({ ...q, method: block.method, method_config: block.config }))];
        const score = scoreSurvey(questions);
        await db.update("SurveyDraft", draft.id as string, { questions, score: score.score, quality: score }).catch(() => null);
        survey = { ...draft, questions, score: score.score };
      }
    }
    return Response.json({ success: true, block, survey });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
