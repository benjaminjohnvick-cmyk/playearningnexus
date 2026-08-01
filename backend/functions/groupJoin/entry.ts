import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { groupSessionsEnabled, clampGroupSize, isMember } from "../../sdk/group.ts";

// groupJoin (authenticated) — join an earn-together group. With session_id, joins that group; otherwise
// matches you into any open group with room, or opens a new one at the default size. Fills to the group's
// chosen size, then marks it active.
//   Body: { session_id?, size? }  → { session_id, status, members }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!groupSessionsEnabled()) return Response.json({ status: "disabled" });

    const body = await req.json().catch(() => ({}));

    let session: Record<string, unknown> | null = null;
    if (body.session_id) {
      session = await db.get("GroupSession", String(body.session_id)).catch(() => null) as Record<string, unknown> | null;
      if (!session) return Response.json({ error: "Group not found" }, { status: 404 });
    } else {
      // Already in an open/active group? Return it.
      const mineOpen = await db.filter("GroupSession", { status: "open" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
      session = (mineOpen || []).find((s) => isMember(s, user.id))
        || (mineOpen || []).find((s) => (Array.isArray(s.members) ? (s.members as string[]).length : 0) < Number(s.size)) || null;
      if (!session) {
        const created = await base44.asServiceRole.entities.GroupSession.create({
          creator_id: user.id, size: clampGroupSize(body.size), members: [user.id], status: "open",
          created_day: new Date().toISOString().slice(0, 10),
        });
        return Response.json({ success: true, session_id: created.id, status: "open", members: 1 });
      }
    }

    const members = Array.isArray(session.members) ? (session.members as string[]).map(String) : [];
    if (!members.includes(user.id)) {
      if (members.length >= Number(session.size)) return Response.json({ error: "Group is full" }, { status: 409 });
      members.push(user.id);
    }
    const full = members.length >= Number(session.size);
    await db.update("GroupSession", session.id as string, { members, status: full ? "active" : "open" }).catch(() => null);

    return Response.json({ success: true, session_id: session.id, status: full ? "active" : "open", members: members.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
