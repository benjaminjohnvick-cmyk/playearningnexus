import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { profileBrowseEnabled, isProfilePublic } from "../../sdk/buddy-profile.ts";
import { bookingEnabled, resolveNextDayBooking } from "../../sdk/buddy-schedule.ts";

// buddyPickMatch (authenticated) — pick a specific member (from buddyProfileBrowse) as your buddy. Picking is
// an INVITE, never a forced pairing: the target gets a notification and pairs only when they come to Buddy Chat.
//   Body: { target_user_id, when?: "now" | "schedule", local_time?, timezone? }
//     • when:"now"      → invite them to pair now (buddyMatch reunites you when they open Buddy Chat).
//     • when:"schedule" → book YOUR next-day slot preferring them, and invite them to the same time.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!profileBrowseEnabled()) return Response.json({ error: "Profile browsing is off." }, { status: 400 });

    const b = await req.json().catch(() => ({}));
    const targetId = String(b.target_user_id || "").trim();
    if (!targetId || targetId === String(user.id)) return Response.json({ error: "A valid target_user_id is required." }, { status: 400 });

    const target = await base44.asServiceRole.entities.User.filter({ id: targetId }).then((r: any) => r[0]).catch(() => null);
    if (!target || !isProfilePublic(target)) return Response.json({ error: "That member isn't available for buddy matching." }, { status: 404 });

    const myFirst = user.full_name ? String(user.full_name).split(" ")[0] : "A member";
    const when = String(b.when || "now");

    if (when === "schedule") {
      if (!bookingEnabled()) return Response.json({ error: "Next-session booking is off." }, { status: 400 });
      const timezone = String(b.timezone || user.timezone || "").trim();
      if (!timezone) return Response.json({ error: "timezone is required to schedule." }, { status: 400 });
      const r = resolveNextDayBooking(String(b.local_time || ""), timezone);
      if (!r.ok) return Response.json({ error: `Could not book that time: ${r.reason}.` }, { status: 400 });

      const nowIso = new Date().toISOString();
      const record = {
        user_id: user.id, next_session_at: r.next_session_at, timezone: r.timezone, local_time: r.local_time,
        utc_bucket: r.utc_bucket, match_preference: "pick", preferred_user_id: targetId,
        status: "booked", source_day: nowIso.slice(0, 10), booked_at: nowIso,
      };
      const existing = await db.filter("BuddyNextSession", { user_id: user.id, status: "booked" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      if (existing?.[0]) await db.update("BuddyNextSession", String(existing[0].id), record).catch(() => null);
      else await base44.asServiceRole.entities.BuddyNextSession.create(record).catch(() => null);

      await base44.asServiceRole.entities.Notification.create({
        user_id: targetId, type: "buddy_invite",
        title: "👋 A buddy invite",
        message: `${myFirst} picked you as an earning buddy and booked ${r.local_time} tomorrow. Book the same time to pair up!`,
        data: { from_user_id: user.id, next_session_at: r.next_session_at, local_time: r.local_time, utc_bucket: r.utc_bucket },
      }).catch(() => null);

      return Response.json({ ok: true, mode: "schedule", target_user_id: targetId, next_session_at: r.next_session_at, local_time: r.local_time, note: `Booked ${r.local_time} tomorrow and invited them.` });
    }

    // when: "now" — create an invite waiting slot targeting them + notify. They pair with you on arrival.
    await base44.asServiceRole.entities.BuddyPair.create({
      user_a: user.id, user_b: null, status: "waiting", source: "invite",
      invited_user_id: targetId, country: (user as Record<string, unknown>).country || null,
      created_day: new Date().toISOString().slice(0, 10),
    }).catch(() => null);
    await base44.asServiceRole.entities.Notification.create({
      user_id: targetId, type: "buddy_invite", action: "open_buddy_chat",
      title: "👋 A buddy invite",
      message: `${myFirst} wants to be your earning buddy. Open Buddy Chat to pair up.`,
      data: { from_user_id: user.id },
    }).catch(() => null);

    return Response.json({ ok: true, mode: "now", target_user_id: targetId, note: "Invite sent. You'll be paired when they open Buddy Chat." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
