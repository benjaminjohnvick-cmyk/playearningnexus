import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { groupSessionsEnabled, clampGroupSize } from "../../sdk/group.ts";

// groupCreate (authenticated) — start an earn-together group of a size YOU choose (clamped to admin bounds).
// You're the first member; others join until it's full.
//   Body: { size, topic? }  → { session_id, size }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!groupSessionsEnabled()) return Response.json({ status: "disabled" });

    const body = await req.json().catch(() => ({}));
    const size = clampGroupSize(body.size);
    const topic = String(body.topic || "").slice(0, 80);

    const session = await base44.asServiceRole.entities.GroupSession.create({
      creator_id: user.id, size, members: [user.id], status: "open", topic,
      created_day: new Date().toISOString().slice(0, 10),
    });
    return Response.json({ success: true, session_id: session.id, size });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
