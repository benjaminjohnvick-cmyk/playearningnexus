import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { bookingEnabled, resolveNextDayBooking, normalizeMatchPreference } from "../../sdk/buddy-schedule.ts";

// buddyScheduleNext (authenticated) — book the NEXT Buddy Chat for tomorrow. Called when a session completes;
// EVERY tier (premium + non-premium) picks a LOCAL time and we store the absolute UTC instant + their IANA
// timezone, so the client can auto-open at exactly that moment and cross-timezone buddies land on the same real
// moment. One active booking per user (re-booking replaces it). Gated behind BUDDY_NEXT_SESSION_BOOKING_ENABLED.
//   Body: { local_time: "HH:MM", timezone: "America/New_York" }
//     → { ok, next_session_at, local_time, timezone, utc_bucket }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!bookingEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Next-session booking is off (BUDDY_NEXT_SESSION_BOOKING_ENABLED)." });
    }

    const b = await req.json().catch(() => ({}));
    const localTime = String(b.local_time || "").trim();
    // Timezone comes from the client (the browser/app knows it via Intl.DateTimeFormat().resolvedOptions().timeZone).
    const timezone = String(b.timezone || user.timezone || "").trim();
    if (!timezone) return Response.json({ error: "timezone is required (send the device's IANA timezone)." }, { status: 400 });

    const r = resolveNextDayBooking(localTime, timezone);
    if (!r.ok) {
      return Response.json({ error: `Could not book that time: ${r.reason}.`, reason: r.reason }, { status: 400 });
    }

    // Who to meet next time: "any" (fastest match), "new" (a NEW buddy, auto-matched on KYC-survey compatibility),
    // or "keep" (try to re-pair with the same buddy). Accepts with_new_user:true as an alias for "new".
    const match_preference = b.with_new_user === true ? "new" : normalizeMatchPreference(b.match_preference);

    const nowIso = new Date().toISOString();
    const record = {
      user_id: user.id,
      next_session_at: r.next_session_at,
      timezone: r.timezone,
      local_time: r.local_time,
      utc_bucket: r.utc_bucket,
      match_preference,
      status: "booked",
      source_day: nowIso.slice(0, 10),
      booked_at: nowIso,
    };

    // One active booking per user: replace any existing not-yet-consumed booking.
    const existing = await db.filter("BuddyNextSession", { user_id: user.id, status: "booked" }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
    const existing2 = await db.filter("BuddyNextSession", { user_id: user.id, status: "notified" }, "-created_date", 5).catch(() => []) as Record<string, unknown>[];
    const stale = [...(existing || []), ...(existing2 || [])];
    let saved: Record<string, unknown> | null = null;
    if (stale.length) {
      await db.update("BuddyNextSession", String(stale[0].id), record).catch(() => null);
      saved = { ...stale[0], ...record };
      // Retire any extra duplicates so only one active booking remains.
      for (const s of stale.slice(1)) await db.update("BuddyNextSession", String(s.id), { status: "consumed" }).catch(() => null);
    } else {
      saved = await base44.asServiceRole.entities.BuddyNextSession.create(record).catch(() => null) as Record<string, unknown> | null;
    }

    return Response.json({
      ok: true, enabled: true,
      next_session_at: r.next_session_at,
      local_time: r.local_time,
      timezone: r.timezone,
      utc_bucket: r.utc_bucket,
      match_preference,
      booking_id: saved?.id ?? null,
      note: `Booked. Buddy Chat will pop up automatically tomorrow at ${r.local_time} (${r.timezone}). ` +
        (match_preference === "new"
          ? "You'll be matched with a NEW buddy chosen for shared interests (from your first-survey profile)."
          : match_preference === "keep"
            ? "We'll try to reunite you with the same buddy."
            : "Buddies who picked the same moment in other timezones will be matched with you."),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
