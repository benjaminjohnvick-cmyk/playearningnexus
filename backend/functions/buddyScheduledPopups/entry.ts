import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { db } from "../../sdk/db.ts";
import { bookingEnabled, popupDue, startGraceMin } from "../../sdk/buddy-schedule.ts";

// buddyScheduledPopups (INTERNAL/ADMIN, scheduled ~every 5 min) — the "auto pop-up" engine. For each booked
// next-session whose chosen moment has arrived (accounting for the lead time), it drops a "buddy_popup"
// notification that tells the client to auto-open Buddy Chat, then marks the booking "notified" so it fires
// once. Bookings older than the start-grace window are expired so they don't pop up stale. The actual pairing
// of same-moment buddies across timezones happens in buddyMatch (it groups by utc_bucket); this job is the
// alarm clock. Gated behind BUDDY_NEXT_SESSION_BOOKING_ENABLED.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!bookingEnabled()) return Response.json({ ok: true, enabled: false, fired: 0 });
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const nowMs = now.getTime();
    const graceMs = startGraceMin() * 60000;

    const body = await req.json().catch(() => ({}));
    const cap = Math.max(1, Math.min(Number(body?.cap) || 500, 2000));

    // Pull the due/booked slots (indexed read by status; bounded per run).
    const booked = await db.filter("BuddyNextSession", { status: "booked" }, "next_session_at", cap).catch(() => []) as Record<string, unknown>[];

    let fired = 0, expired = 0;
    for (const slot of booked) {
      const at = String(slot.next_session_at || "");
      if (!at) continue;
      const atMs = new Date(at).getTime();
      // Expire bookings whose whole window has already passed (missed) so they don't pop up late.
      if (nowMs > atMs + graceMs) {
        await db.update("BuddyNextSession", String(slot.id), { status: "expired" }).catch(() => null);
        expired++;
        continue;
      }
      if (!popupDue(at, now)) continue; // not yet time

      await base44.asServiceRole.entities.Notification.create({
        user_id: slot.user_id,
        type: "buddy_popup",
        title: "👥 Buddy Chat time!",
        message: `It's the time you picked (${slot.local_time}). Tap to jump back into Buddy Chat and earn together.`,
        action: "open_buddy_chat",   // the client auto-opens Buddy Chat when it sees this
        data: { utc_bucket: slot.utc_bucket, next_session_at: at, local_time: slot.local_time, timezone: slot.timezone },
      }).catch(() => null);

      await db.update("BuddyNextSession", String(slot.id), { status: "notified", notified_at: now.toISOString() }).catch(() => null);
      fired++;
    }

    return Response.json({ ok: true, enabled: true, fired, expired, scanned: booked.length });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
