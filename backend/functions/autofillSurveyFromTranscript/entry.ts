import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { InvokeLLM } from "../../sdk/integrations.ts";
import { verifiedSurveysEnabled } from "../../sdk/verified-survey.ts";

// autofillSurveyFromTranscript — map a respondent's spoken transcript onto the survey's questions,
// producing PROPOSED answers the respondent then reviews and confirms. This NEVER submits anything and
// NEVER pays out — it only suggests. The respondent stays in control (they can change any answer).
//   Body: { survey_id, transcript }
//   →     { proposals: [{ question_index, selected_option, open_text, confidence }] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await verifiedSurveysEnabled())) {
      return Response.json({ blocked: true, message: "Verified surveys aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id || "");
    const transcript = String(body.transcript || "").trim();
    if (!surveyId || !transcript) return Response.json({ error: "survey_id and transcript are required" }, { status: 400 });

    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: surveyId }).catch(() => []);
    const survey = (surveys || [])[0];
    if (!survey) return Response.json({ error: "Survey not found" }, { status: 404 });

    const questions = (survey.questions as Array<Record<string, unknown>>) || [];
    if (!questions.length) return Response.json({ proposals: [] });

    const qBlock = questions.map((q, i) =>
      `Q${i + 1}: ${String(q.question || "")}\n  a) ${q.option_a ?? ""}\n  b) ${q.option_b ?? ""}\n  c) ${q.option_c ?? ""}\n  d) ${q.option_d ?? ""}`
    ).join("\n");

    const prompt =
      "A survey respondent SPOKE their answers; here is the transcript. Map what they said onto each " +
      "question. For each question, pick the multiple-choice option (a/b/c/d) that best matches what they " +
      "said, and extract the exact words they said about that question as open_text. If they didn't clearly " +
      "address a question, set selected_option to null and open_text to \"\" and confidence low. Never invent " +
      "answers.\n\n" +
      `SURVEY: ${String(survey.title || "")}\n${qBlock}\n\nTRANSCRIPT: "${transcript.slice(0, 3000)}"\n\n` +
      "Return an array 'proposals', one item per question in order, each { question_index, selected_option " +
      "(\"a\"|\"b\"|\"c\"|\"d\"|null), open_text, confidence (0-1) }.";

    const out = await InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          proposals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_index: { type: "number" },
                selected_option: { type: ["string", "null"] },
                open_text: { type: "string" },
                confidence: { type: "number" },
              },
              required: ["question_index"],
            },
          },
        },
        required: ["proposals"],
      },
    }).catch(() => null) as { proposals?: Array<Record<string, unknown>> } | null;

    // Normalize: clamp indices, lowercase option letters, default missing fields. One entry per question.
    const raw = (out?.proposals || []) as Array<Record<string, unknown>>;
    const byIndex = new Map<number, Record<string, unknown>>();
    for (const p of raw) { const i = Number(p.question_index); if (Number.isInteger(i)) byIndex.set(i, p); }
    const proposals = questions.map((_q, i) => {
      const p = byIndex.get(i) || {};
      let opt = p.selected_option == null ? null : String(p.selected_option).toLowerCase();
      if (opt && !["a", "b", "c", "d"].includes(opt)) opt = null;
      return {
        question_index: i,
        selected_option: opt,
        open_text: String(p.open_text || "").slice(0, 500),
        confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
      };
    });

    return Response.json({ proposals, transcript_used: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
