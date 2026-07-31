import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// setSurveyCommitment (authenticated) — the user picks the daily time they'll do their $8 of surveys, plus
// their timezone offset. Stored on the User; drives the daily nudge + streak. Body:
//   { hour: 0-23, tz_offset_minutes?: number }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const hour = Math.max(0, Math.min(23, Math.round(Number(body.hour))));
    if (!Number.isFinite(hour)) return Response.json({ error: "hour (0-23) required" }, { status: 400 });
    const tz = Number.isFinite(Number(body.tz_offset_minutes)) ? Math.round(Number(body.tz_offset_minutes)) : 0;

    await db.update("User", user.id, {
      survey_commit_hour: hour,
      survey_commit_tz: tz,
      survey_commit_set_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ success: true, hour, tz_offset_minutes: tz, message: `You're set to do your surveys around ${hour}:00. We'll remind you and keep your streak going.` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
