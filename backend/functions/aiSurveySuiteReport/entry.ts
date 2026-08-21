import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { surveySuiteEnabled, surveyConversationalEnabled } from "../../sdk/survey-suite.ts";

// aiSurveySuiteReport — AI Reports: read a survey's questionnaire + responses, tally closed questions, code
// open-ended answers into themes, and draft an evidence-based summary with recommendations. (Pollfish-parity
// AI Reports on our own response data.)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!surveySuiteEnabled()) return Response.json({ error: "The AI Survey Suite is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id ?? body.draft_id ?? "");
    if (!surveyId) return Response.json({ error: "survey_id required." }, { status: 400 });

    // Load the questionnaire (SurveyDraft or PPCSurvey) and its responses.
    const draft = await db.get("SurveyDraft", surveyId).catch(() => null) as Record<string, unknown> | null;
    const questions: Record<string, unknown>[] = Array.isArray(draft?.questions) ? draft!.questions as Record<string, unknown>[] : (Array.isArray(body.questions) ? body.questions : []);
    const responses = Array.isArray(body.responses) && body.responses.length
      ? body.responses as Record<string, unknown>[]
      : await db.filter("PPCSurveyResponse", { survey_id: surveyId }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];

    // Closed-question tallies (deterministic).
    const n = responses.length;
    const tallies = questions.map((q, qi) => {
      const key = String(q.key ?? `q${qi}`);
      const counts: Record<string, number> = {};
      let numericSum = 0, numericN = 0;
      for (const r of responses) {
        const ans = ((r.answers as Record<string, unknown>) || r)[key];
        if (ans == null) continue;
        if (typeof ans === "number") { numericSum += ans; numericN++; }
        else { const v = String(ans); counts[v] = (counts[v] || 0) + 1; }
      }
      return {
        question: q.stem ?? q.question, question_type: q.question_type, key,
        distribution: counts,
        mean: numericN ? Math.round((numericSum / numericN) * 100) / 100 : null,
      };
    });

    // Open-ended coding + executive summary via the LLM (grounded in the tallies).
    let ai = { summary: "", themes: [], recommendations: [] };
    if (surveyConversationalEnabled()) {
      const openAnswers = responses.flatMap((r) => {
        const a = (r.answers as Record<string, unknown>) || r;
        return Object.values(a).filter((v) => typeof v === "string" && String(v).length > 20);
      }).slice(0, 200);
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a market-research analyst. Write an evidence-based summary of this survey (n=${n}).
Closed-question tallies: ${JSON.stringify(tallies).slice(0, 3000)}
Open-ended answers (sample): ${JSON.stringify(openAnswers).slice(0, 3000)}
Return: a concise executive summary, the top themes from open-ends (with an approximate share), and 3–5 actionable recommendations. Do not invent numbers beyond the data.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            themes: { type: "array", items: { type: "object", properties: { theme: { type: "string" }, share_pct: { type: "number" }, example: { type: "string" } } } },
            recommendations: { type: "array", items: { type: "string" } },
          },
        },
      }).catch(() => null);
      if (res) ai = res;
    }

    return Response.json({
      success: true, survey_id: surveyId, responses: n,
      report: { n, tallies, summary: ai.summary, themes: ai.themes, recommendations: ai.recommendations, generated_at: new Date().toISOString() },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
