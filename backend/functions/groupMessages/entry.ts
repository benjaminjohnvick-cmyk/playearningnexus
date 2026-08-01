import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember } from "../../sdk/group.ts";

// groupMessages (authenticated) — recent group chat. Membership-only. Read-only.
//   Body: { session_id, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit) || 60));

    const session = await db.get("GroupSession", sessionId).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Not found" }, { status: 404 });
    if (!isMember(session, user.id)) return Response.json({ error: "Not your group." }, { status: 403 });

    const rows = await db.filter("GroupMessage", { session_id: sessionId }, "-created_date", limit).catch(() => []) as Record<string, unknown>[];
    const messages = (rows || []).filter((m) => !m.flagged).map((m) => ({
      id: m.id, from_me: m.from_user_id === user.id, from_name: m.from_name || "Member", kind: m.kind, text: m.text, at: m.created_date,
    })).reverse();

    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
