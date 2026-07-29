import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { commitmentPace, surveyMinutesPerDay } from "../../sdk/premium-ppc.ts";

// premiumPPCSetLockoutTime (authenticated) — the up-front member sets/updates their daily lockout-mode
// window: the local time each day they'll be reminded to complete their ~8-minute survey commitment.
// This is an IN-APP focus/reminder mode (a web/native PWA can't lock the whole phone), so it schedules
// a daily reminder and a full-screen in-app survey prompt at the chosen time. Members who defaulted and
// are re-enrolling agree to keep this on; anyone may turn it on voluntarily to stay on pace. Nothing is
// charged or clawed back — this only helps the member keep their pace.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const enabled = body.enabled !== false; // default true
    let time: string | null = null;
    if (body.lockout_time != null) {
      const t = String(body.lockout_time).trim();
      // Accept HH:MM 24-hour local time.
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
        return Response.json({ error: "lockout_time must be HH:MM (24-hour), e.g. 19:30." }, { status: 400 });
      }
      time = t;
    }

    const members = await base44.asServiceRole.entities.PremiumPPCMembership.filter({ user_id: user.id });
    const member = (members || []).find((m: Record<string, unknown>) =>
      (m.status === "active" || m.status === "ceiling_reached") && m.upfront_grant) || null;
    if (!member) return Response.json({ ok: false, reason: "not in an active up-front term" }, { status: 404 });

    // If a member previously defaulted, they may turn lockout ON but not OFF (it's a re-enrollment condition).
    if (member.defaulted && !enabled) {
      return Response.json({ error: "Lockout mode is required for this term and can't be turned off." }, { status: 409 });
    }

    const patch: Record<string, unknown> = { lockout_mode_enabled: enabled };
    if (time !== null) patch.lockout_time = time;
    await db.update("PremiumPPCMembership", String(member.id), patch).catch(() => null);

    return Response.json({
      ok: true,
      lockout_mode_enabled: enabled,
      lockout_time: time !== null ? time : (member.lockout_time ?? null),
      survey_minutes_per_day: surveyMinutesPerDay(),
      pace: commitmentPace(member),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
