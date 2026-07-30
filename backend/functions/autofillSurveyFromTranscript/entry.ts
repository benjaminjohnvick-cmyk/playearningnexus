import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { InvokeLLM } from "../../sdk/integrations.ts";
import { verifiedSurveysEnabled } from "../../sdk/verified-survey.ts";
import { matchAnswer } from "../../sdk/answer-match.ts";
import { snapNumber } from "../../sdk/settings.ts";

// autofillSurveyFromTranscript — map a respondent's spoken/typed answer onto the survey's questions,
// producing PROPOSED answers the respondent then reviews and confirms. NEVER submits, NEVER pays out —
// it only suggests; the respondent stays in control and can change any answer.
//
// COST DESIGN — rules first, AI only when needed:
//   1. Run the FREE rules matcher (answer-match.ts) on every question. On plain closed-choice surveys it
//      confidently resolves the large majority for $0.
//   2. Only the questions it can't resolve above AUTOFILL_MATCH_MIN_CONFIDENCE get sent — in ONE batched
//      cheap-tier call — to the LLM. If the rules matcher handles everything, NO AI call is made at all.
//   Body: { survey_id, transcript }
//   →     { proposals: [{ question_index, selected_option, open_text, confidence, source }] , ai_used }
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

    const minConf = Math.max(0, Math.min(1, snapNumber("AUTOFILL_MATCH_MIN_CONFIDENCE", 0.5)));

    // 1) FREE rules pass.
    const proposals = questions.map((q, i) => {
      const m = matchAnswer(q, transcript);
      return {
        question_index: i,
        selected_option: m.option,
        open_text: m.open_text.slice(0, 500),
        confidence: m.confidence,
        source: m.source as string,
      };
    });

    // 2) Only the low-confidence questions go to the cheap-tier LLM — batched into one call.
    const lowConf = proposals.filter((p) => !p.selected_option || p.confidence < minConf);
    let aiUsed = false;
    if (lowConf.length > 0) {
      const qBlock = lowConf.map((p) => {
        const q = questions[p.question_index];
        return `Q${p.question_index}: ${String(q.question || "")}\n  a) ${q.option_a ?? ""}\n  b) ${q.option_b ?? ""}\n  c) ${q.option_c ?? ""}\n  d) ${q.option_d ?? ""}`;
      }).join("\n");

      const prompt =
        "A survey respondent gave their answers (spoken or typed); here is their text. For ONLY the " +
        "questions listed below, pick the multiple-choice option (a/b/c/d) that best matches what they said, " +
        "and extract the words they used as open_text. If they didn't clearly address a question, set " +
        "selected_option to null and confidence low. Never invent answers.\n\n" +
        `SURVEY: ${String(survey.title || "")}\n${qBlock}\n\nTEXT: "${transcript.slice(0, 3000)}"\n\n` +
        "Return an array 'proposals', one item per listed question, each { question_index, selected_option " +
        "(\"a\"|\"b\"|\"c\"|\"d\"|null), open_text, confidence (0-1) }.";

      const out = await InvokeLLM({
        prompt,
        model: "gpt_5_mini",   // cheap tier, and only for the ambiguous minority
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

      if (out?.proposals) {
        aiUsed = true;
        const byIndex = new Map<number, Record<string, unknown>>();
        for (const p of out.proposals) { const i = Number(p.question_index); if (Number.isInteger(i)) byIndex.set(i, p); }
        for (const p of proposals) {
          if (p.selected_option && p.confidence >= minConf) continue; // keep confident rules matches
          const ai = byIndex.get(p.question_index);
          if (!ai) continue;
          let opt = ai.selected_option == null ? null : String(ai.selected_option).toLowerCase();
          if (opt && !["a", "b", "c", "d"].includes(opt)) opt = null;
          p.selected_option = opt as string | null;
          p.open_text = String(ai.open_text || p.open_text || "").slice(0, 500);
          p.confidence = Math.max(0, Math.min(1, Number(ai.confidence) || 0));
          p.source = "ai";
        }
      }
    }

    return Response.json({ proposals, ai_used: aiUsed, transcript_used: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
