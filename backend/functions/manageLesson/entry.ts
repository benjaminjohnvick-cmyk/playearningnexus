import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// INCREMENT 5 — Lesson safety controls.
// An admin can VETO a bad lesson (excluded from what agents recall) or PIN a good one (always
// recalled). This is the human guard so a wrong "lesson" can't quietly degrade an agent.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !["admin", "developer"].includes(user.role)) {
      return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
    }
    const { lesson_id, action } = await req.json();
    if (!lesson_id || !["veto", "unveto", "pin", "unpin"].includes(action)) {
      return Response.json({ error: "Provide lesson_id and action (veto|unveto|pin|unpin)" }, { status: 400 });
    }
    const patch: Record<string, unknown> =
      action === "veto" ? { vetoed: true } :
      action === "unveto" ? { vetoed: false } :
      action === "pin" ? { pinned: true } :
      { pinned: false };
    patch.moderated_by = user.id;
    patch.moderated_at = new Date().toISOString();

    await base44.asServiceRole.entities.AgentLearningMemory.update(lesson_id, patch);
    return Response.json({ ok: true, lesson_id, action });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
