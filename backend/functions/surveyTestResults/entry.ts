import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { getNumber, snapBool } from "../../sdk/settings.ts";
import { summarizeValidation } from "../../sdk/survey-test.ts";

// surveyTestResults — the "will it sell?" read for a validation survey. Aggregates responses into interest,
// purchase intent, expected price, and comments, plus a plain signal (strong / mixed / weak / insufficient).
// Explicitly FEEDBACK, never a guarantee. Only the survey's creator (or an admin) can read it. Gated behind
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
    const surveyId = String(body?.survey_id || "");
    if (!surveyId) return Response.json({ error: "survey_id required" }, { status: 400 });

    const survey = await db.get("Survey", surveyId).catch(() => null) as Record<string, unknown> | null;
    if (!survey) return Response.json({ error: "unknown survey" }, { status: 404 });
    const isOwner = String(survey.created_by_user ?? "") === String(user.id);
    if (!isOwner && user.role !== "admin") return Response.json({ error: "only the survey creator can view results" }, { status: 403 });

    // Pull responses from the common response tables (best-effort across the schema).
    let responses = await db.filter("SurveyResponse", { survey_id: surveyId }, "-created_date", 5000).catch(() => []) as Array<Record<string, unknown>>;
    if (!responses.length) responses = await db.filter("FeedbackSurveyResponse", { survey_id: surveyId }, "-created_date", 5000).catch(() => []) as Array<Record<string, unknown>>;
    if (!responses.length) responses = await db.filter("PPCSurveyResponse", { survey_id: surveyId }, "-created_date", 5000).catch(() => []) as Array<Record<string, unknown>>;

    const minResponses = Math.max(1, await getNumber("SURVEY_TEST_MIN_RESPONSES", 5));
    const summary = summarizeValidation(responses, minResponses);

    return Response.json({
      ok: true,
      survey_id: surveyId,
      subject: survey.validation_of ?? null,
      ...summary,
      note: "This is a feedback signal to help you decide whether to sell/host — it is not a guarantee of sales or earnings.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
