import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember } from "../../sdk/group.ts";

// groupLeave (authenticated) — leave a group (optionally reporting it). Removes you from the roster; if the
// group empties it ends. A report is surfaced to moderators.
//   Body: { session_id, reason? }  → { success }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session = await db.get("GroupSession", String(body.session_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Not found" }, { status: 404 });
    if (!isMember(session, user.id)) return Response.json({ error: "Not your group." }, { status: 403 });

    const members = (session.members as string[] || []).map(String).filter((m) => m !== user.id);
    await db.update("GroupSession", session.id as string, {
      members, status: members.length === 0 ? "ended" : session.status,
    }).catch(() => null);

    const reason = String(body.reason || "").slice(0, 300);
    if (reason) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" }).catch(() => []);
      for (const a of (admins || []).slice(0, 5)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: (a as Record<string, unknown>).id, type: "moderation",
          title: "🚩 Group report", message: `Group ${session.id} reported. Reason: ${reason.slice(0, 120)}`,
        }).catch(() => null);
      }
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
