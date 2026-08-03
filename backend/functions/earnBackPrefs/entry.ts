import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// earnBackPrefs (authenticated) — set the member's stay-on-track prefs for one ownership plan: daily
// reminders and/or lockout mode. Lockout mode means the member's phone opens at their set time each day and
// stays locked until they complete that day's survey minutes toward their chosen % ownership — the daily
// reminder cron and the client LockoutModeEnforcer read these flags + the plan's daily minute target.
//   Body: { plan_id, reminders_enabled?, lockout_enabled?, lockout_time? }  → { ok, plan_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = await db.get("EarnBackPlan", String(body.plan_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!plan) return Response.json({ error: "Plan not found." }, { status: 404 });
    if (plan.user_id !== user.id) return Response.json({ error: "Not your plan." }, { status: 403 });

    // Daily survey-minute target for this plan = remaining minutes spread over the remaining days (min 1/day).
    const cycleDays = 30;
    const remaining = Math.max(0, (Number(plan.minutes_required) || 0) - (Number(plan.minutes_done) || 0));
    const dailyTargetMinutes = Math.max(1, Math.ceil(remaining / cycleDays));

    const patch: Record<string, unknown> = { daily_target_minutes: dailyTargetMinutes };
    if (body.reminders_enabled !== undefined) patch.reminders_enabled = !!body.reminders_enabled;
    if (body.lockout_enabled !== undefined) patch.lockout_enabled = !!body.lockout_enabled;
    if (body.lockout_time) patch.lockout_time = String(body.lockout_time).slice(0, 5);   // "HH:MM"

    await db.update("EarnBackPlan", plan.id as string, patch);

    return Response.json({
      ok: true,
      plan_id: plan.id,
      daily_target_minutes: dailyTargetMinutes,
      reminders_enabled: patch.reminders_enabled ?? plan.reminders_enabled ?? false,
      lockout_enabled: patch.lockout_enabled ?? plan.lockout_enabled ?? false,
      note: "Lockout keeps your phone locked at your set time until you complete today's survey minutes toward your ownership. Set the daily time in Lockout settings.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
