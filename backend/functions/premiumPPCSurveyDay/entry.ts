import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { markSurveyDay, makeupPlan, commitmentPace, surveyMinutesPerDay } from "../../sdk/premium-ppc.ts";

// premiumPPCSurveyDay (authenticated) — credit the member's survey progress for TODAY.
// Called by the survey-completion flow. Supports MAKE-UP: pass the day's cumulative `minutes` and extra
// minutes credit multiple sessions (each = ~8 min) to catch up missed days — one make-up session per day
// missed, bounded by the full-year requirement. Idempotent within the day. Falling behind never creates a
// debt; the member has the full commitment window to make it up. Returns the fresh make-up plan for the UI.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const minutes = Number(body?.minutes);

    const res = await markSurveyDay(user.id, Number.isFinite(minutes) ? minutes : surveyMinutesPerDay());
    if (!res) return Response.json({ ok: false, reason: "not in an active up-front term" });

    // Reload the membership so the returned plan/pace reflect the credit just applied.
    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const member = (members || []).find((m: Record<string, unknown>) => m.status === "active" && m.upfront_grant) || null;

    return Response.json({
      ok: true,
      already: res.already,
      credited: res.credited,
      survey_days: res.survey_days,
      makeup: member ? makeupPlan(member) : null,
      pace: member ? commitmentPace(member) : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
