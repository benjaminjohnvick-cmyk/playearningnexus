import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { validateSurvey, saveActiveSurvey, KYC_SURVEY } from "../../sdk/kyc.ts";
import { db } from "../../sdk/db.ts";

// kycSurveyAdminSave (ADMIN) — a HUMAN manually adjusts the KYC survey. Validates the submitted survey,
// makes it the live active survey (what new members see), and records an audit-log entry.
//   Body: { survey }  OR  { reset: true }  (reset to the built-in default)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const survey = body?.reset ? KYC_SURVEY : body?.survey;
    const v = validateSurvey(survey);
    if (!v.ok || !v.survey) return Response.json({ error: v.error || "Invalid survey." }, { status: 400 });

    await saveActiveSurvey(v.survey, "human", user.id);
    await db.create("AdminAuditLog", {
      actor_email: user.email, actor_id: user.id, action_type: "kyc_survey_update",
      target: "kyc_survey", details: { reset: !!body?.reset, questions: v.survey.questions.length },
      timestamp: new Date().toISOString(),
    }, user.id).catch(() => null);

    return Response.json({ ok: true, survey: v.survey });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
