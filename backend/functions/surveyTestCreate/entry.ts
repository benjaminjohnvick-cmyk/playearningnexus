import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { validationQuestions } from "../../sdk/survey-test.ts";

// surveyTestCreate — "Test it first." An unsure user creates a FREE validation survey to gauge whether a product
// or video idea will land, before committing to sell or host. Free to create; respondents complete it as a
// standard advertiser-funded PPC survey and keep the full Site-Cash reward (nothing skimmed). The creator gets
// aggregated feedback via surveyTestResults. This is a FEEDBACK tool, never an income/sales promise. Gated behind
// SURVEY_TEST_FIRST_ENABLED.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("SURVEY_TEST_FIRST_ENABLED", false)) {
      return Response.json({ error: "Survey-test-first is disabled (SURVEY_TEST_FIRST_ENABLED off)." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || body?.product_name || "this product").slice(0, 160);
    const kind = body?.kind === "video" ? "video" : "product";

    // Try an LLM to enrich the questions for this specific subject; fall back to the default set.
    let questions = validationQuestions(subject);
    if (body?.ai !== false) {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write 4-6 short survey questions to validate whether "${subject}" (${kind}) will sell / resonate. Cover interest, purchase intent, expected price, and open feedback. Return each as {id, text, type} where type is one of scale|yes_no|currency|text. Neutral wording; do not imply guaranteed results.`,
        response_json_schema: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string" } }, required: ["id", "text", "type"] } } }, required: ["questions"] },
      }).catch(() => null) as { questions?: Array<{ id: string; text: string; type: string }> } | null;
      if (r?.questions?.length) {
        questions = r.questions.map((q) => ({ id: String(q.id || "q"), text: String(q.text || ""), type: (["scale", "yes_no", "currency", "text"].includes(String(q.type)) ? q.type : "text") as ValidationQ })).filter((q) => q.text);
      }
    }

    // Free validation survey. Advertiser-funded so respondents earn the standard reward; creator not charged.
    const survey = await base44.asServiceRole.entities.Survey.create({
      title: `Validation: ${subject}`,
      kind: "product_validation",
      validation_of: subject, validation_type: kind,
      questions,
      created_by_user: user.id,
      advertiser_funded: true,     // respondents earn the standard Site-Cash reward; nothing skimmed
      free_to_create: true,        // the creator is not charged to test
      status: "active",
      disclosure: "Validation survey — results are feedback only, not a sales guarantee.",
      created_at: new Date().toISOString(),
    }).catch(() => null);

    if (!survey) return Response.json({ error: "could not create validation survey" }, { status: 500 });

    return Response.json({
      ok: true,
      survey_id: String((survey as Record<string, unknown>).id ?? ""),
      subject, kind, questions,
      note: "Free validation survey created. Respondents complete it and keep the full Site-Cash reward; you'll get aggregated feedback via surveyTestResults. Results are a signal, not a guarantee of sales.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

type ValidationQ = "scale" | "yes_no" | "currency" | "text";
