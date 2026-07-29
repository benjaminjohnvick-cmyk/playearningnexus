import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getSurveyAdminView, validateSurvey, saveActiveSurvey, clearProposal } from "../../sdk/kyc.ts";
import { db } from "../../sdk/db.ts";

// kycSurveyProposalDecide (ADMIN) — approve or reject the pending AI-proposed KYC survey. Approving makes
// it the live active survey; rejecting discards it. This is the human review gate on AI adjustments.
//   Body: { action: "apply" | "reject" }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { action } = await req.json().catch(() => ({}));
    if (!["apply", "reject"].includes(action)) return Response.json({ error: 'action must be "apply" or "reject".' }, { status: 400 });

    const view = await getSurveyAdminView();
    if (!view.proposal) return Response.json({ error: "There's no pending AI proposal." }, { status: 409 });

    if (action === "reject") {
      await clearProposal();
      await db.create("AdminAuditLog", { actor_email: user.email, actor_id: user.id, action_type: "kyc_survey_proposal_reject", target: "kyc_survey", timestamp: new Date().toISOString() }, user.id).catch(() => null);
      return Response.json({ ok: true, applied: false });
    }

    const v = validateSurvey(view.proposal);
    if (!v.ok || !v.survey) { await clearProposal(); return Response.json({ error: `Proposal was invalid and has been discarded: ${v.error}` }, { status: 422 }); }
    await saveActiveSurvey(v.survey, "ai", user.id);
    await db.create("AdminAuditLog", { actor_email: user.email, actor_id: user.id, action_type: "kyc_survey_proposal_apply", target: "kyc_survey", details: { questions: v.survey.questions.length }, timestamp: new Date().toISOString() }, user.id).catch(() => null);
    return Response.json({ ok: true, applied: true, survey: v.survey });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
