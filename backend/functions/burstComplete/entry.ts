import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { computeBurstStatus, normalizePace } from "../../sdk/burst.ts";

// burstComplete (authenticated) — record that the user finished a burst unit (a survey / AdGrid unit) so the
// on-the-go tracker advances and stays in sync across devices. The actual earning is credited by the survey
// postbacks; this only tracks burst COUNT + last-active. Upserts the day's BurstSession.
//   Body: { unit?: "bitlabs_survey"|"adgrid"|"other", device? }  → { day_status }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const device = String(body.device || "web").slice(0, 40);
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const bsRows = await db.filter("BurstSession", { user_id: user.id, day: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    let burstsCompleted = 1;
    if (bsRows?.[0]) {
      burstsCompleted = (Number(bsRows[0].bursts_completed) || 0) + 1;
      await db.update("BurstSession", bsRows[0].id as string, { bursts_completed: burstsCompleted, last_active_at: nowIso, last_device: device }).catch(() => null);
    } else {
      await base44.asServiceRole.entities.BurstSession.create({
        user_id: user.id, day: today, bursts_completed: 1, pace: normalizePace(body.pace), last_active_at: nowIso, last_device: device,
      }).catch(() => null);
    }

    // Fresh earnings snapshot for the returned status.
    const earnRows = await db.filter("DailyEarnings", { user_id: user.id, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const earnedUsd = Number(earnRows?.[0]?.survey_gross) || Number(earnRows?.[0]?.total_earned) || 0;

    return Response.json({ success: true, day_status: computeBurstStatus(today, earnedUsd, burstsCompleted) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
