import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { utcDay, commitmentPace } from "../../sdk/premium-ppc.ts";

// premiumPPCSurveyDay (authenticated) — mark that the member met their survey requirement for TODAY.
// Called by the survey-completion flow once the daily quota (~8 min) is done. Idempotent per UTC day;
// counts toward the year's commitment. Members can catch up by completing on days they were behind.
// Falling behind never creates a debt — the only consequence is the lockout in premiumPPCStatus.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const member = (members || []).find((m: Record<string, unknown>) => m.status === "active" && m.upfront_grant) || null;
    if (!member) return Response.json({ ok: false, reason: "not in an active up-front term" });

    const today = utcDay();
    if (member.last_survey_day === today) {
      return Response.json({ ok: true, already: true, survey_days: Number(member.survey_days) || 0, pace: commitmentPace(member) });
    }
    const newDays = (Number(member.survey_days) || 0) + 1;
    await db.update("PremiumPPCMembership", String(member.id), { survey_days: newDays, last_survey_day: today }).catch(() => null);
    return Response.json({ ok: true, survey_days: newDays, pace: commitmentPace({ ...member, survey_days: newDays, last_survey_day: today }) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
