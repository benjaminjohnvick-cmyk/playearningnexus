import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { setAiPaused, logAiAction } from "../../sdk/ai-control.ts";
import { db } from "../../sdk/db.ts";

// aiControlPause (ADMIN) — the STOP button. Engage (paused:true) to instantly halt all AI-driven changes
// (optimizer pass, self-learning, autonomous auto-apply). Release (paused:false) to resume.
//   Body: { paused: boolean }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const { paused } = await req.json().catch(() => ({}));
    if (typeof paused !== "boolean") return Response.json({ error: "Provide { paused: true|false }." }, { status: 400 });

    await setAiPaused(paused, user.id);
    await logAiAction({
      agent: "human", action: paused ? "ai_pause" : "ai_resume", target: "ai_paused",
      status: paused ? "paused" : "applied",
      summary: paused ? `AI STOPPED by ${user.email || "admin"}` : `AI resumed by ${user.email || "admin"}`,
    }).catch(() => null);
    await db.create("AdminAuditLog", {
      actor_email: user.email, actor_id: user.id, action_type: paused ? "ai_pause" : "ai_resume",
      target: "ai_paused", timestamp: new Date().toISOString(),
    }, user.id).catch(() => null);

    return Response.json({ ok: true, paused });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
